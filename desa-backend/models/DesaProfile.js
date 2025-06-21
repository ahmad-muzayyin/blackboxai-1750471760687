module.exports = (sequelize, DataTypes) => {
  const DesaProfile = sequelize.define('DesaProfile', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    namaDesa: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    kodeDesa: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    kecamatan: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    kabupaten: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    provinsi: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    kodePos: {
      type: DataTypes.STRING(10),
      validate: {
        isNumeric: true,
        len: [5, 10]
      }
    },
    alamat: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    telepon: {
      type: DataTypes.STRING(20),
      validate: {
        is: /^[0-9+()-\s]+$/
      }
    },
    email: {
      type: DataTypes.STRING(100),
      validate: {
        isEmail: true
      }
    },
    website: {
      type: DataTypes.STRING(100),
      validate: {
        isUrl: true
      }
    },
    logoUrl: {
      type: DataTypes.STRING(255),
      validate: {
        isUrl: true
      }
    },
    visi: {
      type: DataTypes.TEXT
    },
    misi: {
      type: DataTypes.TEXT
    },
    luasWilayah: {
      type: DataTypes.FLOAT,
      validate: {
        min: 0
      }
    },
    batasWilayah: {
      type: DataTypes.JSON,
      defaultValue: {
        utara: '',
        selatan: '',
        timur: '',
        barat: ''
      }
    },
    jumlahDusun: {
      type: DataTypes.INTEGER,
      validate: {
        min: 0
      }
    },
    jumlahRW: {
      type: DataTypes.INTEGER,
      validate: {
        min: 0
      }
    },
    jumlahRT: {
      type: DataTypes.INTEGER,
      validate: {
        min: 0
      }
    },
    dataGeografis: {
      type: DataTypes.JSON,
      defaultValue: {
        ketinggian: '',
        curahHujan: '',
        suhu: '',
        topografi: ''
      }
    },
    potensiDesa: {
      type: DataTypes.JSON,
      defaultValue: {
        pertanian: [],
        peternakan: [],
        perikanan: [],
        wisata: [],
        kerajinan: [],
        lainnya: []
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
    tableName: 'desa_profile',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['kodeDesa']
      }
    ],
    hooks: {
      beforeValidate: (profile) => {
        // Capitalize proper nouns
        if (profile.namaDesa) {
          profile.namaDesa = profile.namaDesa
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        }
      }
    }
  });

  // Instance Methods
  DesaProfile.prototype.getFullAddress = function() {
    return `${this.alamat}, Desa ${this.namaDesa}, Kec. ${this.kecamatan}, Kab. ${this.kabupaten}, ${this.provinsi} ${this.kodePos}`;
  };

  DesaProfile.prototype.updateProfile = async function(data, userId) {
    Object.assign(this, data);
    this.updatedBy = userId;
    return this.save();
  };

  // Class Methods
  DesaProfile.getActiveProfile = async function() {
    return await this.findOne({
      order: [['updatedAt', 'DESC']]
    });
  };

  // Define associations
  DesaProfile.associate = function(models) {
    DesaProfile.belongsTo(models.User, {
      foreignKey: 'updatedBy',
      as: 'lastUpdatedBy'
    });

    // Optional: If you want to track profile changes
    DesaProfile.hasMany(models.DesaProfileHistory, {
      foreignKey: 'profileId',
      as: 'history'
    });
  };

  return DesaProfile;
};
