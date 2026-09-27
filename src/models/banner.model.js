const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Banner = sequelize.define('Banner', {
  title: { type: DataTypes.STRING, allowNull: false },
  subtitle: { type: DataTypes.STRING, allowNull: false },
  imageUrl: { type: DataTypes.STRING, allowNull: false },
  linkUrl: { type: DataTypes.STRING, defaultValue: '#catalogo' },
  active: { type: DataTypes.BOOLEAN, defaultValue: true }
});

module.exports = Banner;
