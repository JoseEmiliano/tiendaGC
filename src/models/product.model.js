const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  name: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  listPrice: { type: DataTypes.FLOAT, allowNull: false },
  transferPrice: { type: DataTypes.FLOAT, allowNull: false },
  stock: { type: DataTypes.INTEGER, defaultValue: 10 },
  warranty: { type: DataTypes.STRING, defaultValue: '1 Año Oficial' },
  imageUrl: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT }
});

module.exports = Product;
