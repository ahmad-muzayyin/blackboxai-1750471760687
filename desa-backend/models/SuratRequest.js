const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const SuratRequest = sequelize.define('SuratRequest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    nomorSurat: {
      type: DataTypes.STRING(100),
      unique: true
    },
    jenisSurat: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    pemohonId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'penduduk',
        key: 'id'
      }
    },
    keperluan: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'approved', 'rejected', 'completed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    tanggalPengajuan: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    tanggalSelesai: {
      type: DataTypes.DATE
    },
    keterangan: {
      type: DataTypes.TEXT
    },
    attachmentUrl: {
      type: DataTypes.STRING(255),
      validate: {
        isUrl: true
      }
    },
    processedBy: {
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
    templateData: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    trackingCode: {
      type: DataTypes.STRING(20),
      unique: true
    }
  }, {
    tableName: 'surat_requests',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['nomorSurat']
      },
      {
        fields: ['status']
      },
      {
        fields: ['tanggalPengajuan']
      },
      {
        fields: ['pemohonId']
      },
      {
        unique: true,
        fields: ['trackingCode']
      }
    ],
    hooks: {
      beforeCreate: async (surat) => {
        // Generate tracking code
        surat.trackingCode = await generateTrackingCode(surat.jenisSurat);
      },
      afterCreate: async (surat) => {
        // Generate nomor surat if status is approved
        if (surat.status === 'approved') {
          surat.nomorSurat = await generateNomorSurat(surat);
          await surat.save();
        }
      },
      beforeUpdate: async (surat) => {
        // Generate nomor surat when status changes to approved
        if (surat.changed('status') && surat.status === 'approved' && !surat.nomorSurat) {
          surat.nomorSurat = await generateNomorSurat(surat);
        }
      }
    }
  });

  // Instance Methods
  SuratRequest.prototype.approve = async function(userId) {
    this.status = 'approved';
    this.approvedBy = userId;
    this.nomorSurat = await generateNomorSurat(this);
    return this.save();
  };

  SuratRequest.prototype.reject = async function(userId, keterangan) {
    this.status = 'rejected';
    this.processedBy = userId;
    this.keterangan = keterangan;
    this.tanggalSelesai = new Date();
    return this.save();
  };

  SuratRequest.prototype.complete = async function(userId) {
    this.status = 'completed';
    this.processedBy = userId;
    this.tanggalSelesai = new Date();
    return this.save();
  };

  // Class Methods
  SuratRequest.findByTrackingCode = async function(trackingCode) {
    return await this.findOne({
      where: { trackingCode },
      include: ['pemohon', 'processor', 'approver']
    });
  };

  // Define associations
  SuratRequest.associate = function(models) {
    SuratRequest.belongsTo(models.Penduduk, {
      foreignKey: 'pemohonId',
      as: 'pemohon'
    });

    SuratRequest.belongsTo(models.User, {
      foreignKey: 'processedBy',
      as: 'processor'
    });

    SuratRequest.belongsTo(models.User, {
      foreignKey: 'approvedBy',
      as: 'approver'
    });

    SuratRequest.hasMany(models.SuratAttachment, {
      foreignKey: 'suratRequestId',
      as: 'attachments'
    });
  };

  // Helper Functions
  async function generateTrackingCode(jenisSurat) {
    const prefix = jenisSurat.substring(0, 2).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  async function generateNomorSurat(surat) {
    const date = new Date();
    const year = date.getFullYear();
    
    // Get the counter for this type of surat in current year
    const count = await SuratRequest.count({
      where: {
        jenisSurat: surat.jenisSurat,
        status: 'approved',
        createdAt: {
          [sequelize.Op.gte]: new Date(year, 0, 1),
          [sequelize.Op.lt]: new Date(year + 1, 0, 1)
        }
      }
    });

    // Format: 001/JNS/DESA/MM/YYYY
    const counter = String(count + 1).padStart(3, '0');
    const jenis = surat.jenisSurat.substring(0, 3).toUpperCase();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    return `${counter}/${jenis}/DESA/${month}/${year}`;
  }

  return SuratRequest;
};
