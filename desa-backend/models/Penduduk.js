module.exports = (sequelize, DataTypes) => {
  const Penduduk = sequelize.define('Penduduk', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    nik: {
      type: DataTypes.STRING(16),
      allowNull: false,
      unique: true,
      validate: {
        len: [16, 16],
        isNumeric: true
      }
    },
    noKK: {
      type: DataTypes.STRING(16),
      allowNull: false,
      validate: {
        len: [16, 16],
        isNumeric: true
      }
    },
    nama: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100]
      }
    },
    tempatLahir: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    tanggalLahir: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        isBefore: new Date().toISOString()
      }
    },
    jenisKelamin: {
      type: DataTypes.ENUM('L', 'P'),
      allowNull: false
    },
    agama: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    statusPerkawinan: {
      type: DataTypes.ENUM('belum_kawin', 'kawin', 'cerai_hidup', 'cerai_mati'),
      allowNull: false
    },
    pekerjaan: {
      type: DataTypes.STRING(100)
    },
    pendidikanTerakhir: {
      type: DataTypes.STRING(50)
    },
    golonganDarah: {
      type: DataTypes.ENUM('A', 'B', 'AB', 'O', 'tidak_tahu'),
      defaultValue: 'tidak_tahu'
    },
    alamat: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    rt: {
      type: DataTypes.STRING(3),
      allowNull: false,
      validate: {
        isNumeric: true,
        len: [1, 3]
      }
    },
    rw: {
      type: DataTypes.STRING(3),
      allowNull: false,
      validate: {
        isNumeric: true,
        len: [1, 3]
      }
    },
    statusTinggal: {
      type: DataTypes.ENUM('tetap', 'tidak_tetap'),
      allowNull: false,
      defaultValue: 'tetap'
    },
    statusHidup: {
      type: DataTypes.ENUM('hidup', 'meninggal'),
      allowNull: false,
      defaultValue: 'hidup'
    },
    kewarganegaraan: {
      type: DataTypes.ENUM('WNI', 'WNA'),
      allowNull: false,
      defaultValue: 'WNI'
    },
    fotoUrl: {
      type: DataTypes.STRING,
      validate: {
        isUrl: true
      }
    },
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'penduduk',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['nik']
      },
      {
        fields: ['noKK']
      },
      {
        fields: ['nama']
      },
      {
        fields: ['rt', 'rw']
      }
    ]
  });

  // Instance Methods
  Penduduk.prototype.getUsia = function() {
    const today = new Date();
    const birthDate = new Date(this.tanggalLahir);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Class Methods
  Penduduk.findByNIK = async function(nik) {
    return await this.findOne({ where: { nik } });
  };

  Penduduk.findByKK = async function(noKK) {
    return await this.findAll({ where: { noKK } });
  };

  // Define associations
  Penduduk.associate = function(models) {
    Penduduk.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    
    Penduduk.hasMany(models.SuratRequest, {
      foreignKey: 'pemohonId',
      as: 'suratRequests'
    });

    Penduduk.hasMany(models.BantuanSosialPenerima, {
      foreignKey: 'pendudukId',
      as: 'bantuanSosial'
    });

    Penduduk.hasMany(models.Pengaduan, {
      foreignKey: 'pelaporId',
      as: 'pengaduan'
    });
  };

  // Hooks
  Penduduk.addHook('beforeValidate', (penduduk) => {
    if (penduduk.nama) {
      penduduk.nama = penduduk.nama.trim().toUpperCase();
    }
  });

  return Penduduk;
};
