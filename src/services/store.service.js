const Product = require('../models/product.model');
const Banner = require('../models/banner.model');
const Setting = require('../models/setting.model');

class StoreService {
  
  async getProcessedCatalog(categoryFilter = null) {
    const rawProducts = await Product.findAll({ raw: true });

    let processed = rawProducts.map(p => {
      const ahorro = p.listPrice - p.transferPrice;
      const ahorroPercent = Math.round((ahorro / p.listPrice) * 100);
      return {
        ...p,
        ahorro,
        ahorroPercent,
        isPC: p.category.includes('PC') || p.category.includes('Gamer') || p.category.includes('Escolar'),
        isCarteleria: p.category.includes('Cartelería') || p.category.includes('Xibo'),
        isCCTV: p.category.includes('CCTV')
      };
    });

    if (categoryFilter && categoryFilter !== 'todos') {
      processed = processed.filter(p => p.category.toLowerCase() === categoryFilter.toLowerCase());
    }

    processed.sort((a, b) => {
      if (a.isPC && !b.isPC) return -1;
      if (!a.isPC && b.isPC) return 1;
      if (a.isCarteleria && !b.isCarteleria) return -1;
      if (!a.isCarteleria && b.isCarteleria) return 1;
      return 0;
    });

    return processed;
  }

  async getInventoryStats() {
    const products = await Product.findAll({ raw: true });
    const stats = products.reduce((acc, curr) => {
      acc.totalStock += curr.stock;
      acc.valoracionTotal += curr.transferPrice * curr.stock;
      return acc;
    }, { totalStock: 0, valoracionTotal: 0 });

    return stats;
  }

  async getGlobalSettings() {
    const rawSettings = await Setting.findAll({ raw: true });
    const settings = {};
    rawSettings.forEach(s => { settings[s.key] = s.value; });
    return settings;
  }
}

module.exports = new StoreService();
