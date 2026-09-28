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
// Rutas de Gestión de Usuarios para el Administrador
app.get('/admin/users', (req, res) => storeController.renderAdminUsers(req, res));
app.post('/admin/users/update-role', (req, res) => storeController.updateUserRole(req, res));
app.post('/admin/users/delete/:id', (req, res) => storeController.deleteUser(req, res));
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
        name: 'PC Armada Escolar (AMD Athlon / 8GB / SSD 240GB)', 
        category: 'PC Escolar', 
        listPrice: 380000, 
        transferPrice: 330000,
        stock: 15,
        warranty: '1 Año Oficial', 
        imageUrl: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=600&q=80',
        description: 'Equipo ideal para estudiantes, clases virtuales y tareas de ofimática escolar.' 
      },
      { 
        name: 'PC Armada Oficina (Intel Core i3 / 8GB / SSD 480GB)', 
        category: 'PC Oficina', 
        listPrice: 490000, 
        transferPrice: 425000,
        stock: 12,
        warranty: '1 Año Oficial', 
        imageUrl: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=600&q=80',
        description: 'Optimizada para software de gestión, ERPs, Excel y facturación continua en comercios.' 
      },
      { 
        name: 'PC Diseño Gráfico & Arquitectura (Core i7 / 32GB / SSD 1TB / RTX 3060)', 
        category: 'PC Diseño & Arquitectura', 
        listPrice: 1450000, 
        transferPrice: 1280000,
        stock: 5,
        warranty: '1 Año Oficial', 
        imageUrl: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=600&q=80',
        description: 'Potencia extrema para AutoCAD, Revit, Adobe Suite y renderizado 3D profesional.' 
      },
      { 
        name: 'PC Alto Procesamiento & Trabajo (AMD Ryzen 9 / 64GB / SSD 2TB)', 
        category: 'PC Alto Procesamiento', 
        listPrice: 1890000, 
        transferPrice: 1690000,
        stock: 4,
        warranty: '1 Año Oficial', 
        imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
        description: 'Máquina de servidores locales, desarrollo pesado, máquinas virtuales y cálculo científico.' 
      },
      { 
        name: 'PC Gamer (Ryzen 5 5600G / 16GB / SSD 480GB / Vega 7)', 
        category: 'PC Gamer', 
        listPrice: 690000, 
        transferPrice: 599000,
        stock: 10,
        warranty: '1 Año Oficial', 
        imageUrl: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=600&q=80',
        description: 'Excelente rendimiento en eSports (Valorant, CS2, Fortnite) y juegos moderados.' 
      },
      { 
        name: 'PC Gamer Pro (Core i5 13400F / 32GB / SSD 1TB / RTX 4060)', 
        category: 'PC Gamer Pro', 
        listPrice: 1350000, 
        transferPrice: 1190000,
        stock: 6,
        warranty: '1 Año Oficial', 
        imageUrl: 'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&w=600&q=80',
        description: 'Gráficos ultra, Ray Tracing y tasa de refresco elevada para los títulos más exigentes.' 
      }
    ]);
  }
  app.listen(PORT, () => {
    logger.info(`Servidor escuchando en http://localhost:${PORT}`);
  });
}).catch(err => {
  logger.error(`Error al iniciar: ${err.message}`);
});
