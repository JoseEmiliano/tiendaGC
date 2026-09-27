#!/bin/bash

# 1. Crear estructura de carpetas
echo "Creando estructura de directorios para GestionCloud..."
mkdir -p src/config src/models src/controllers logs

# 2. Crear .env
echo "Creando .env..."
cat << 'EOF' > .env
PORT=3000
DB_HOST=postgres
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=gestioncloud_db
DB_PORT=5432
SESSION_SECRET=gestioncloud_secret_2026_key
EOF

# 3. Crear package.json
echo "Creando package.json..."
cat << 'EOF' > package.json
{
  "name": "gestioncloud-store",
  "version": "2.0.0",
  "description": "E-commerce B2B y B2C autoadministrable",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "express-rate-limit": "^7.2.0",
    "express-session": "^1.18.0",
    "express-validator": "^7.0.1",
    "helmet": "^7.1.0",
    "pg": "^8.11.3",
    "pg-hstore": "^2.3.4",
    "sequelize": "^6.37.1",
    "winston": "^3.12.0"
  }
}
EOF

# 4. Crear Dockerfile
echo "Creando Dockerfile..."
cat << 'EOF' > Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
EOF

# 5. Crear docker-compose.yml
echo "Creando docker-compose.yml..."
cat << 'EOF' > docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: gestioncloud_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: gestioncloud_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    container_name: gestioncloud_app
    restart: always
    ports:
      - "3010:3000"
    environment:
      - DB_HOST=postgres
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=gestioncloud_db
      - DB_PORT=5432
      - SESSION_SECRET=gestioncloud_secret_2026_key
    depends_on:
      - postgres
    volumes:
      - .:/app
      - /app/node_modules

volumes:
  pgdata:
EOF

# 6. Crear src/config/logger.js
echo "Creando src/config/logger.js..."
cat << 'EOF' > src/config/logger.js
const { createLogger, format, transports } = require('winston');
const path = require('path');

const logger = createLogger({
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(info => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`)
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: path.join(__dirname, '../../logs/error.log'), level: 'error' }),
    new transports.File({ filename: path.join(__dirname, '../../logs/combined.log') })
  ]
});

module.exports = logger;
EOF

# 7. Crear src/config/database.js
echo "Creando src/config/database.js..."
cat << 'EOF' > src/config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    port: process.env.DB_PORT || 5432,
    logging: false
  }
);

module.exports = sequelize;
EOF

# 8. Crear Modelos
echo "Creando modelos de datos..."
cat << 'EOF' > src/models/product.model.js
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
EOF

cat << 'EOF' > src/models/banner.model.js
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
EOF

cat << 'EOF' > src/models/user.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'empleado', 'cliente'), defaultValue: 'cliente' },
  phone: { type: DataTypes.STRING }
});

module.exports = User;
EOF

cat << 'EOF' > src/models/audit.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  userEmail: { type: DataTypes.STRING, allowNull: false },
  action: { type: DataTypes.STRING, allowNull: false },
  details: { type: DataTypes.TEXT },
  ipAddress: { type: DataTypes.STRING }
});

module.exports = AuditLog;
EOF

# 9. Crear Controlador
echo "Creando src/controllers/store.controller.js..."
cat << 'EOF' > src/controllers/store.controller.js
const Product = require('../models/product.model');
const User = require('../models/user.model');
const Banner = require('../models/banner.model');
const AuditLog = require('../models/audit.model');
const logger = require('../config/logger');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');

class StoreController {
  async createProduct(req, res) {
    try {
      if (!req.session.user || req.session.user.role === 'cliente') return res.status(403).send('Acceso denegado.');
      const { name, category, listPrice, transferPrice, stock, warranty, imageUrl, description } = req.body;
      await Product.create({ name, category, listPrice, transferPrice, stock, warranty, imageUrl, description });
      await AuditLog.create({ userEmail: req.session.user.email, action: 'CREAR_PRODUCTO', details: name, ipAddress: req.ip });
      res.redirect('/?success=producto_creado');
    } catch (error) {
      logger.error(error.message);
      res.status(500).send('Error al crear producto');
    }
  }

  async deleteProduct(req, res) {
    try {
      if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Acceso denegado.');
      await Product.destroy({ where: { id: req.params.id } });
      res.redirect('/');
    } catch (error) {
      logger.error(error.message);
      res.status(500).send('Error al eliminar');
    }
  }

  async createBanner(req, res) {
    try {
      if (!req.session.user || req.session.user.role === 'cliente') return res.status(403).send('Acceso denegado.');
      const { title, subtitle, imageUrl, linkUrl } = req.body;
      await Banner.create({ title, subtitle, imageUrl, linkUrl });
      res.redirect('/?success=banner_creado');
    } catch (error) {
      logger.error(error.message);
      res.status(500).send('Error al crear banner');
    }
  }

  async deleteBanner(req, res) {
    try {
      if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Acceso denegado.');
      await Banner.destroy({ where: { id: req.params.id } });
      res.redirect('/');
    } catch (error) {
      logger.error(error.message);
      res.status(500).send('Error al eliminar banner');
    }
  }

  async registerUser(req, res) {
    try {
      const { name, email, password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      await User.create({ name, email, password: hashedPassword, role: 'cliente' });
      res.redirect('/?success=registrado');
    } catch (error) {
      res.status(400).send('Error en el registro. Correo duplicado.');
    }
  }

  async loginUser(req, res) {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).send('Credenciales inválidas.');
      req.session.user = { id: user.id, name: user.name, role: user.role, email: user.email };
      res.redirect('/');
    } catch (error) {
      res.status(500).send('Error de login');
    }
  }

  async logoutUser(req, res) {
    req.session.destroy(() => { res.redirect('/'); });
  }

  async renderStore(req, res) {
    try {
      const products = await Product.findAll();
      const banners = await Banner.findAll({ where: { active: true } });
      const currentUser = req.session.user || null;

      const bannersHtml = banners.map(b => `
        <div class="bg-gradient-to-r from-blue-950 via-slate-900 to-[#050811] border border-cyan-500/30 rounded-3xl p-8 md:p-12 text-white shadow-2xl flex flex-col md:flex-row justify-between items-center relative overflow-hidden mb-6">
            <div class="max-w-xl z-10">
                <span class="bg-cyan-500/10 text-cyan-400 text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-widest border border-cyan-500/20 mb-3 inline-block">GestionCloud Ecosistema</span>
                <h1 class="text-2xl md:text-4xl font-black uppercase tracking-tight mb-3 leading-tight">${b.title}</h1>
                <p class="text-slate-300 text-xs md:text-sm mb-5 leading-relaxed">${b.subtitle}</p>
                <a href="${b.linkUrl}" class="bg-cyan-500 text-slate-950 font-black px-6 py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20 inline-block">Ver Solución</a>
                ${currentUser && currentUser.role === 'admin' ? `
                    <form action="/api/banners/delete/${b.id}" method="POST" class="inline-block ml-3">
                        <button type="submit" class="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-2 rounded-lg text-[10px] uppercase font-bold hover:bg-red-500 hover:text-white">Eliminar Banner</button>
                    </form>
                ` : ''}
            </div>
            <div class="mt-6 md:mt-0 z-10">
                <img src="${b.imageUrl}" alt="${b.title}" class="w-64 h-36 object-cover rounded-2xl shadow-xl border border-cyan-500/20">
            </div>
        </div>
      `).join('') || '';

      const productsHtml = products.map(p => {
        const ahorro = p.listPrice - p.transferPrice;
        const ahorroPercent = Math.round((ahorro / p.listPrice) * 100);
        const mensajeWhatsApp = `Hola GestionCloud! 🚀 Soy ${currentUser ? currentUser.name : 'Cliente'}. Me interesa adquirir: *${p.name}* a $${Number(p.transferPrice).toLocaleString()} (Transferencia/Alias).`;

        return `
          <div class="group bg-[#0b0f19] border border-slate-800 rounded-2xl overflow-hidden p-4 flex flex-col justify-between hover:shadow-2xl hover:border-cyan-500/50 transition-all duration-300">
              <div>
                  <div class="relative mb-3 overflow-hidden rounded-xl bg-[#030712] border border-slate-800 p-3">
                      <span class="absolute top-2 left-2 z-10 bg-cyan-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider">-${ahorroPercent}% TRANSFERENCIA</span>
                      <img src="${p.imageUrl}" alt="${p.name}" class="w-full h-48 object-contain group-hover:scale-105 transition-transform duration-500">
                  </div>
                  <span class="text-[10px] bg-cyan-950 text-cyan-400 font-bold px-2.5 py-1 rounded-md uppercase tracking-widest border border-cyan-800/50">${p.category}</span>
                  <h3 class="text-sm font-bold text-white mt-3 mb-2 line-clamp-2 leading-snug">${p.name}</h3>
                  <p class="text-xs text-slate-400 mb-4 line-clamp-2">${p.description}</p>
              </div>
              <div>
                  <div class="mb-4 bg-[#050811] p-3 rounded-xl border border-slate-800">
                      <div class="text-[10px] text-slate-500 line-through uppercase">Lista: $${Number(p.listPrice).toLocaleString()}</div>
                      <div class="text-xl font-black text-white">$${Number(p.transferPrice).toLocaleString()} <span class="text-[9px] text-cyan-400 font-bold uppercase block">Transferencia / Alias</span></div>
                  </div>
                  <div class="flex gap-2">
                      <a href="https://wa.me/5491155741154?text=${encodeURIComponent(mensajeWhatsApp)}" target="_blank" class="flex-1 text-center bg-cyan-500 text-slate-950 font-black py-2.5 rounded-xl hover:bg-cyan-400 transition uppercase text-xs tracking-wider shadow-lg shadow-cyan-500/20"><i class="fab fa-whatsapp mr-1"></i> Consultar</a>
                      ${currentUser && currentUser.role === 'admin' ? `
                          <form action="/api/products/delete/${p.id}" method="POST" onsubmit="return confirm('¿Eliminar producto?');">
                              <button type="submit" class="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-2.5 rounded-xl hover:bg-red-500 hover:text-white transition" title="Eliminar"><i class="fas fa-trash"></i></button>
                          </form>
                      ` : ''}
                  </div>
              </div>
          </div>
        `;
      }).join('');

      res.send(getStoreHtml(bannersHtml, productsHtml, currentUser));
    } catch (error) {
      logger.error(error.message);
      res.status(500).send('Error interno');
    }
  }
}

function getStoreHtml(bannersHtml, productsHtml, currentUser) {
  return `<!DOCTYPE html>
<html lang="es" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <title>GestionCloud | Tienda Oficial E-Commerce</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        body { font-family: 'Inter', sans-serif; background-color: #030712; color: #f8fafc; }
    </style>
</head>
<body class="antialiased min-h-screen flex flex-col justify-between bg-[#030712]">

    <nav class="sticky top-0 z-50 bg-[#050811]/95 backdrop-blur-md border-b border-slate-800 px-6 py-4 shadow-xl">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="text-white text-xl font-black tracking-wider flex items-center gap-2">
                <div class="bg-slate-900 border border-slate-700 p-1.5 rounded-lg text-cyan-400 font-mono text-sm">&gt;_</div>
                <span>GESTION<span class="text-cyan-400">CLOUD</span></span>
                <span class="text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold px-2 py-0.5 rounded uppercase tracking-widest ml-2">Tienda Oficial</span>
            </div>
            
            <div class="w-full md:w-1/3 relative">
                <input type="text" placeholder="Buscar soluciones tecnológicas..." class="w-full bg-[#0b0f19] text-white text-xs px-5 py-3 rounded-full border border-slate-800 focus:outline-none focus:border-cyan-400 shadow-inner">
                <button class="absolute right-4 top-3 text-slate-400 hover:text-cyan-400"><i class="fas fa-search"></i></button>
            </div>

            <div class="flex items-center space-x-6 text-xs font-bold uppercase tracking-widest text-slate-300">
                <a href="#catalogo" class="hover:text-cyan-400 transition"><i class="fas fa-store mr-1"></i> Catálogo</a>
                <a href="#faq" class="hover:text-cyan-400 transition"><i class="fas fa-info-circle mr-1"></i> Ayuda</a>
                ${currentUser && (currentUser.role === 'admin' || currentUser.role === 'empleado') ? '<a href="#panel-admin" class="text-cyan-400 hover:underline"><i class="fas fa-cogs mr-1"></i> Panel Admin</a>' : ''}
                ${currentUser ? `
                    <span class="text-cyan-300 font-bold">(${currentUser.role}:${currentUser.name})</span>
                    <a href="/logout" class="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg">Salir</a>
                ` : `
                    <a href="#auth-section" class="bg-cyan-500 text-slate-950 px-4 py-2 rounded-xl font-black hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20">Ingresar</a>
                `}
            </div>
        </div>
    </nav>

    <header class="max-w-7xl mx-auto px-6 pt-8 w-full">
        ${bannersHtml}
    </header>

    <main id="catalogo" class="max-w-7xl mx-auto px-6 py-12 w-full">
        <div class="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
            <h2 class="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                <i class="fas fa-shopping-bag text-cyan-400"></i> Catálogo de Soluciones Llave en Mano
            </h2>
            <span class="text-xs text-slate-400 uppercase tracking-widest font-semibold">Transferencia / Alias</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            ${productsHtml}
        </div>
    </main>

    ${currentUser && (currentUser.role === 'admin' || currentUser.role === 'empleado') ? `
    <section id="panel-admin" class="py-12 px-6 max-w-5xl mx-auto w-full border-t border-slate-800 grid md:grid-cols-2 gap-8">
        <div class="bg-[#0b0f19] border border-slate-800 p-8 rounded-3xl shadow-2xl">
            <h3 class="text-lg font-black text-white uppercase mb-4 text-center"><i class="fas fa-plus-circle text-cyan-400 mr-2"></i> Agregar Producto</h3>
            <form action="/api/products" method="POST" class="space-y-4">
                <input type="text" name="name" required placeholder="Nombre del Kit o Solución" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400">
                <select name="category" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400">
                    <option value="Kioscos & POS">Kioscos & POS</option>
                    <option value="Cartelería Digital (Xibo)">Cartelería Digital (Xibo)</option>
                    <option value="CCTV & Seguridad">CCTV & Seguridad</option>
                    <option value="Estudios & PyMEs">Estudios & PyMEs</option>
                    <option value="Apps Web a Medida">Apps Web a Medida</option>
                </select>
                <div class="grid grid-cols-2 gap-2">
                    <input type="number" name="listPrice" required placeholder="Precio Lista ($)" class="bg-[#030712] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400">
                    <input type="number" name="transferPrice" required placeholder="Precio Transferencia ($)" class="bg-[#030712] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400">
                </div>
                <input type="url" name="imageUrl" required placeholder="URL Imagen" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400">
                <textarea name="description" rows="2" required placeholder="Descripción..." class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400"></textarea>
                <button type="submit" class="w-full bg-cyan-500 text-slate-950 font-black uppercase py-3 rounded-xl text-xs hover:bg-cyan-400 transition">Publicar Producto</button>
            </form>
        </div>

        <div class="bg-[#0b0f19] border border-slate-800 p-8 rounded-3xl shadow-2xl">
            <h3 class="text-lg font-black text-white uppercase mb-4 text-center"><i class="fas fa-bullhorn text-cyan-400 mr-2"></i> Agregar Banner</h3>
            <form action="/api/banners" method="POST" class="space-y-4">
                <input type="text" name="title" required placeholder="Título del Banner" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400">
                <input type="text" name="subtitle" required placeholder="Subtítulo / Descripción" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400">
                <input type="url" name="imageUrl" required placeholder="URL de Imagen" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400">
                <input type="text" name="linkUrl" placeholder="Enlace (ej: #catalogo)" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400">
                <button type="submit" class="w-full bg-slate-900 border border-slate-700 text-white font-black uppercase py-3 rounded-xl text-xs hover:bg-slate-800 transition">Crear Banner</button>
            </form>
        </div>
    </section>
    ` : ''}

    ${!currentUser ? `
    <section id="auth-section" class="py-12 px-6 max-w-4xl mx-auto w-full border-t border-slate-800 grid md:grid-cols-2 gap-8">
        <div class="bg-[#0b0f19] border border-slate-800 p-8 rounded-3xl shadow-xl">
            <h3 class="text-lg font-black text-white uppercase mb-4">Iniciar Sesión</h3>
            <form action="/api/login" method="POST" class="space-y-4">
                <input type="email" name="email" required placeholder="Correo" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none">
                <input type="password" name="password" required placeholder="Contraseña" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none">
                <button type="submit" class="w-full bg-slate-900 border border-slate-700 text-white font-black uppercase py-3 rounded-xl text-xs">Entrar</button>
            </form>
        </div>
        <div class="bg-[#0b0f19] border border-slate-800 p-8 rounded-3xl shadow-xl">
            <h3 class="text-lg font-black text-white uppercase mb-4">Registro</h3>
            <form action="/api/register" method="POST" class="space-y-4">
                <input type="text" name="name" required placeholder="Nombre" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none">
                <input type="email" name="email" required placeholder="Correo" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none">
                <input type="password" name="password" required placeholder="Contraseña" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none">
                <button type="submit" class="w-full bg-cyan-500 text-slate-950 font-black uppercase py-3 rounded-xl text-xs">Registrarse</button>
            </form>
        </div>
    </section>
    ` : ''}

    <footer class="bg-[#050811] text-slate-400 border-t border-slate-800 pt-16 pb-12 px-6 mt-16 text-xs text-center">
        <p>GestionCloud E-Commerce & Solutions &copy; 2026. Todos los derechos reservados.</p>
        <p class="text-[10px] text-slate-500 mt-1">Node.js, Express & PostgreSQL - Plataforma Autoadministrable.</p>
    </footer>
</body>
</html>`;
}

module.exports = new StoreController();
EOF

# 10. Crear Servidor Principal
echo "Creando src/app.js..."
cat << 'EOF' > src/app.js
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const sequelize = require('./config/database');
const Product = require('./models/product.model');
const User = require('./models/user.model');
const Banner = require('./models/banner.model');
const AuditLog = require('./models/audit.model');
const logger = require('./config/logger');
const storeController = require('./controllers/store.controller');

require('dotenv').config();

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/login', limiter);
app.use('/api/register', limiter);

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

app.post('/api/products', (req, res) => storeController.createProduct(req, res));
app.post('/api/products/delete/:id', (req, res) => storeController.deleteProduct(req, res));
app.post('/api/banners', (req, res) => storeController.createBanner(req, res));
app.post('/api/banners/delete/:id', (req, res) => storeController.deleteBanner(req, res));
app.post('/api/register', (req, res) => storeController.registerUser(req, res));
app.post('/api/login', (req, res) => storeController.loginUser(req, res));
app.get('/logout', (req, res) => storeController.logoutUser(req, res));
app.get('/', (req, res) => storeController.renderStore(req, res));

const PORT = process.env.PORT || 3000;

sequelize.sync({ alter: true }).then(async () => {
  logger.info('Base de datos sincronizada.');

  const adminExists = await User.findOne({ where: { role: 'admin' } });
  if (!adminExists) {
    const hashed = await bcrypt.hash('admin2026', 10);
    await User.create({ name: 'Jose Nuñez (Admin)', email: 'admin@gestioncloud.com.ar', password: hashed, role: 'admin' });
    logger.info('Admin creado: admin@gestioncloud.com.ar / admin2026');
  }

  const bannerCount = await Banner.count();
  if (bannerCount === 0) {
    await Banner.create({
      title: 'Soluciones Tecnológicas Llave en Mano',
      subtitle: 'Equipamiento comercial, puntos de venta para kioscos, cartelería digital Xibo y kits de cámaras Hikvision.',
      imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80',
      linkUrl: '#catalogo'
    });
  }

  const productCount = await Product.count();
  if (productCount === 0) {
    await Product.bulkCreate([
      { 
        name: 'Combo Kiosco POS Completo (Mini PC + Térmica + Lector)', 
        category: 'Kioscos & POS', 
        listPrice: 590000, 
        transferPrice: 510000,
        stock: 10,
        warranty: '1 Año Oficial', 
        imageUrl: 'https://images.unsplash.com/photo-1556742049-0a67d553c245?auto=format&fit=crop&w=600&q=80',
        description: 'Solución integral de mostrador para kioscos y comercios minoristas listos para facturar.' 
      },
      { 
        name: 'Kit CCTV Hikvision 4 Cámaras HD + NVR + Instalación', 
        category: 'CCTV & Seguridad', 
        listPrice: 980000, 
        transferPrice: 820000,
        stock: 8,
        warranty: '1 Año Oficial', 
        imageUrl: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&w=600&q=80',
        description: 'Sistema completo con visualización remota en el celular. Instalación llave en mano.' 
      }
    ]);
  }

  app.listen(PORT, () => {
    logger.info(`Servidor escuchando en http://localhost:${PORT}`);
  });
}).catch(err => {
  logger.error(`Error al iniciar: ${err.message}`);
});
EOF

echo "¡Estructura creada con éxito! Ahora ejecutá: docker compose up --build -d"
