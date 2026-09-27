const Product = require('../models/product.model');
const User = require('../models/user.model');
const Banner = require('../models/banner.model');
const Setting = require('../models/setting.model');
const AuditLog = require('../models/audit.model');
const storeService = require('../services/store.service');
const logger = require('../config/logger');
const bcrypt = require('bcrypt');
const sequelize = require('../config/database'); // <-- ASEGURATE DE TENER ESTA LÍNEA
class StoreController {
  
  async createProduct(req, res) {
    try {
      if (!req.session.user || req.session.user.role === 'cliente') return res.status(403).send('Acceso denegado.');
      const { name, category, listPrice, transferPrice, stock, warranty, imageUrl, description } = req.body;
      await Product.create({ name, category, listPrice, transferPrice, stock, warranty, imageUrl, description });
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

  async updateSettings(req, res) {
    try {
      if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).send('Acceso denegado.');
      const { brandName, mainTitle, mainSubtitle, footerText, socialTwitter, socialInstagram, socialLinkedIn } = req.body;
      
      const updates = { brandName, mainTitle, mainSubtitle, footerText, socialTwitter, socialInstagram, socialLinkedIn };
      for (const [key, value] of Object.entries(updates)) {
        await Setting.upsert({ key, value });
      }

      res.redirect('/?success=web_actualizada');
    } catch (error) {
      logger.error(error.message);
      res.status(500).send('Error al actualizar configuración');
    }
  }

  async registerUser(req, res) {
    try {
      const { name, email, password, phone } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      await User.create({ name, email, password: hashedPassword, role: 'cliente', phone });
      res.redirect('/?success=registrado');
    } catch (error) {
      res.status(400).send('Error en el registro. El correo ya está en uso.');
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
      // Ordenamos para priorizar PCs armadas primero, luego cartelería y CCTV
      const products = await Product.findAll({
        order: [
          [sequelize.literal(`CASE 
            WHEN category LIKE 'PC%' THEN 1 
            WHEN category LIKE '%Cartelería%' OR category LIKE '%Xibo%' THEN 2 
            WHEN category LIKE '%CCTV%' THEN 3 
            ELSE 4 END`), 'ASC']
        ]
      });
      const banners = await Banner.findAll({ where: { active: true } });
      const rawSettings = await Setting.findAll();
      const currentUser = req.session.user || null;

      const settings = {};
      rawSettings.forEach(s => { settings[s.key] = s.value; });

      const bannersHtml = banners.map(b => `
        <div class="bg-gradient-to-r from-blue-950 via-slate-900 to-[#050811] border border-cyan-500/30 rounded-3xl p-8 md:p-12 text-white shadow-2xl flex flex-col md:flex-row justify-between items-center relative overflow-hidden mb-6">
            <div class="max-w-xl z-10">
                <span class="bg-cyan-500/10 text-cyan-400 text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-widest border border-cyan-500/20 mb-3 inline-block">Promoción Oficial Marcas</span>
                <h1 class="text-2xl md:text-4xl font-black uppercase tracking-tight mb-3 leading-tight">${b.title}</h1>
                <p class="text-slate-300 text-xs md:text-sm mb-5 leading-relaxed">${b.subtitle}</p>
                <a href="${b.linkUrl}" class="bg-cyan-500 text-slate-950 font-black px-6 py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20 inline-block">Ver Promoción</a>
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
        const mensajeWhatsApp = `Hola ${settings.brandName || 'GestionCloud'}! 🚀 Soy ${currentUser ? currentUser.name : 'Cliente'}. Me interesa adquirir: *${p.name}* a $${Number(p.transferPrice).toLocaleString()} (Transferencia/Alias).`;

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

      res.send(getStoreHtml(bannersHtml, productsHtml, currentUser, settings));
    } catch (error) {
      logger.error(error.message);
      res.status(500).send('Error interno');
    }
  }
}

function getStoreHtml(bannersHtml, productsHtml, currentUser, settings) {
  return `<!DOCTYPE html>
<html lang="es" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <title>${settings.brandName || 'GestionCloud'} | Tienda Oficial - PCs Armadas & Soluciones</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        body { font-family: 'Inter', sans-serif; background-color: #030712; color: #f8fafc; }
    </style>
</head>
<body class="antialiased min-h-screen flex flex-col justify-between bg-[#030712]">

    <!-- NAVBAR -->
    <nav class="sticky top-0 z-50 bg-[#050811]/95 backdrop-blur-md border-b border-slate-800 px-6 py-4 shadow-xl">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="text-white text-xl font-black tracking-wider flex items-center gap-2">
                <div class="bg-slate-900 border border-slate-700 p-1.5 rounded-lg text-cyan-400 font-mono text-sm">&gt;_</div>
                <span>${settings.brandName || 'GESTIONCLOUD'}</span>
                <span class="text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold px-2 py-0.5 rounded uppercase tracking-widest ml-2">Tienda Oficial</span>
            </div>
            
            <div class="flex items-center space-x-6 text-xs font-bold uppercase tracking-widest text-slate-300">
                <a href="#catalogo" class="hover:text-cyan-400 transition"><i class="fas fa-desktop mr-1"></i> PCs & Kits</a>
                <a href="#quienes-somos" class="hover:text-cyan-400 transition"><i class="fas fa-user-tie mr-1"></i> Dueño</a>
                <a href="#ubicacion" class="hover:text-cyan-400 transition"><i class="fas fa-map-marker-alt mr-1"></i> Ubicación</a>
                <a href="#contacto" class="hover:text-cyan-400 transition"><i class="fas fa-envelope mr-1"></i> Contacto</a>
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

    <!-- HERO -->
    <header class="max-w-7xl mx-auto px-6 pt-8 w-full text-center mb-6">
        <h2 class="text-3xl md:text-5xl font-black text-white uppercase tracking-tight">${settings.mainTitle || ''}</h2>
        <p class="text-slate-400 text-xs md:text-sm mt-2 max-w-2xl mx-auto">${settings.mainSubtitle || ''}</p>
    </header>

    <div class="max-w-7xl mx-auto px-6 w-full">
        ${bannersHtml}
    </div>

    <!-- CATÁLOGO (PCs ARMADAS EN PRIMER LUGAR) -->
    <main id="catalogo" class="max-w-7xl mx-auto px-6 py-12 w-full">
        <div class="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
            <h2 class="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                <i class="fas fa-desktop text-cyan-400"></i> PCs Armadas Especializadas, Cartelería & CCTV
            </h2>
            <span class="text-xs text-slate-400 uppercase tracking-widest font-semibold">Transferencia / Alias</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            ${productsHtml}
        </div>
    </main>

    <!-- QUIÉNES SOMOS / DUEÑO (SIN MENCIONAR TRABAJO ACTUAL) -->
    <section id="quienes-somos" class="max-w-7xl mx-auto px-6 py-12 w-full border-t border-slate-800">
        <div class="bg-[#0b0f19] border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl grid md:grid-cols-3 gap-8 items-center">
            <div class="text-center md:text-left">
                <div class="w-36 h-36 mx-auto md:mx-0 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-900 flex items-center justify-center text-4xl font-black text-white shadow-xl border-2 border-cyan-400/50">
                    JN
                </div>
                <div class="mt-4 text-center md:text-left">
                    <span class="text-xs text-cyan-400 font-mono block">UNPAZ • Analista de Sistemas (82%)</span>
                    <span class="text-[11px] text-slate-400 block mt-1">Especialista en Infraestructura & DevOps</span>
                </div>
            </div>
            <div class="md:col-span-2 space-y-4">
                <span class="bg-cyan-500/10 text-cyan-400 text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-widest border border-cyan-500/20 inline-block">Fundador & Arquitecto Tecnológico</span>
                <h3 class="text-2xl font-black text-white uppercase tracking-tight">José Nuñez</h3>
                <p class="text-xs md:text-sm text-slate-300 leading-relaxed">
                    Al frente de <strong>${settings.brandName || 'GestionCloud'}</strong>, lidero el desarrollo de ecosistemas tecnológicos, infraestructura agnóstica en contenedores y armado de estaciones de trabajo de alto rendimiento. Como estudiante avanzado en la <strong>UNPAZ</strong>, construyo soluciones robustas y seguras para PyMEs, estudios profesionales y clientes particulares, garantizando excelencia técnica y venta directa.
                </p>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 text-xs font-bold text-slate-300">
                    <div class="bg-[#030712] border border-slate-800 p-2.5 rounded-xl"><i class="fas fa-microchip text-cyan-400 mr-1.5"></i> PCs de Alto Rendimiento</div>
                    <div class="bg-[#030712] border border-slate-800 p-2.5 rounded-xl"><i class="fas fa-server text-cyan-400 mr-1.5"></i> Infraestructura & Docker</div>
                    <div class="bg-[#030712] border border-slate-800 p-2.5 rounded-xl"><i class="fas fa-shield-alt text-cyan-400 mr-1.5"></i> Soporte Directo</div>
                </div>
            </div>
        </div>
    </section>

    <!-- UBICACIÓN Y CONTACTO -->
    <section id="ubicacion" class="max-w-7xl mx-auto px-6 py-12 w-full border-t border-slate-800 grid md:grid-cols-2 gap-8">
        <div class="bg-[#0b0f19] border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col justify-between">
            <div>
                <h3 class="text-lg font-black text-white uppercase mb-2"><i class="fas fa-map-marker-alt text-cyan-400 mr-2"></i> Nuestra Ubicación</h3>
                <p class="text-xs text-slate-400 mb-4">Presidente Derqui, Provincia de Buenos Aires, Argentina. Atención a toda la región y despachos coordinados.</p>
            </div>
            <div class="w-full h-64 rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
                <iframe width="100%" height="100%" frameborder="0" scrolling="no" marginheight="0" marginwidth="0" src="https://maps.google.com/maps?q=Presidente%20Derqui,%20Buenos%20Aires,%20Argentina&t=&z=13&ie=UTF8&iwloc=&output=embed" class="w-full h-full grayscale contrast-125 opacity-80 hover:opacity-100 transition"></iframe>
            </div>
        </div>

        <div id="contacto" class="bg-[#0b0f19] border border-slate-800 p-8 rounded-3xl shadow-2xl">
            <h3 class="text-lg font-black text-white uppercase mb-2"><i class="fas fa-paper-plane text-cyan-400 mr-2"></i> Formulario de Contacto</h3>
            <p class="text-xs text-slate-400 mb-6">Dejanos tu consulta sobre PCs armadas o kits tecnológicos y te responderemos a la brevedad.</p>
            <form action="https://wa.me/5491155741154" method="GET" target="_blank" class="space-y-4">
                <input type="text" name="text" placeholder="Tu Nombre / Empresa" required class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-cyan-400">
                <input type="email" placeholder="Correo electrónico" required class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-cyan-400">
                <textarea rows="3" placeholder="Mensaje o requerimiento tecnológico..." required class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-cyan-400"></textarea>
                <button type="submit" class="w-full bg-cyan-500 text-slate-950 font-black uppercase py-3 rounded-xl text-xs hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20">Enviar Consulta vía WhatsApp</button>
            </form>
        </div>
    </section>

    <!-- PANEL ADMIN -->
    ${currentUser && (currentUser.role === 'admin' || currentUser.role === 'empleado') ? `
    <section id="panel-admin" class="py-12 px-6 max-w-6xl mx-auto w-full border-t border-slate-800 space-y-8">
        <div class="text-center">
            <h2 class="text-2xl font-black text-white uppercase"><i class="fas fa-tools text-cyan-400 mr-2"></i> Panel de Administración CMS</h2>
            <p class="text-xs text-slate-400 mt-1">Control total de contenidos, textos principales, logo, redes sociales, banners y productos.</p>
        </div>

        <div class="grid md:grid-cols-3 gap-8">
            <div class="bg-[#0b0f19] border border-slate-800 p-6 rounded-3xl shadow-2xl">
                <h3 class="text-sm font-black text-white uppercase mb-4"><i class="fas fa-globe text-cyan-400 mr-2"></i> Textos y Redes de la Web</h3>
                <form action="/api/settings" method="POST" class="space-y-3">
                    <div>
                        <label class="block text-[10px] text-slate-400 uppercase font-bold mb-1">Nombre / Logo (Marca)</label>
                        <input type="text" name="brandName" value="${settings.brandName || ''}" required class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 uppercase font-bold mb-1">Título Principal (Hero)</label>
                        <input type="text" name="mainTitle" value="${settings.mainTitle || ''}" required class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 uppercase font-bold mb-1">Subtítulo Principal</label>
                        <input type="text" name="mainSubtitle" value="${settings.mainSubtitle || ''}" required class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 uppercase font-bold mb-1">Texto del Footer</label>
                        <input type="text" name="footerText" value="${settings.footerText || ''}" required class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 uppercase font-bold mb-1">Enlace Red Social (Twitter/X)</label>
                        <input type="url" name="socialTwitter" value="${settings.socialTwitter || ''}" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 uppercase font-bold mb-1">Enlace Red Social (Instagram)</label>
                        <input type="url" name="socialInstagram" value="${settings.socialInstagram || ''}" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                    </div>
                    <button type="submit" class="w-full bg-cyan-500 text-slate-950 font-black uppercase py-2.5 rounded-xl text-xs hover:bg-cyan-400 transition">Guardar Cambios Web</button>
                </form>
            </div>

            <div class="bg-[#0b0f19] border border-slate-800 p-6 rounded-3xl shadow-2xl">
                <h3 class="text-sm font-black text-white uppercase mb-4"><i class="fas fa-desktop text-cyan-400 mr-2"></i> Agregar PC o Kit</h3>
                <form action="/api/products" method="POST" class="space-y-3">
                    <input type="text" name="name" required placeholder="Nombre (Ej: PC Gamer Pro)" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                    <select name="category" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                        <option value="PC Escolar">PC Escolar</option>
                        <option value="PC Oficina">PC Oficina</option>
                        <option value="PC Diseño & Arquitectura">PC Diseño & Arquitectura</option>
                        <option value="PC Alto Procesamiento">PC Alto Procesamiento</option>
                        <option value="PC Gamer">PC Gamer</option>
                        <option value="PC Gamer Pro">PC Gamer Pro</option>
                        <option value="Cartelería Digital (Xibo)">Cartelería Digital (Xibo)</option>
                        <option value="CCTV & Seguridad">CCTV & Seguridad</option>
                    </select>
                    <div class="grid grid-cols-2 gap-2">
                        <input type="number" name="listPrice" required placeholder="Precio Lista ($)" class="bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                        <input type="number" name="transferPrice" required placeholder="Precio Transf. ($)" class="bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                    </div>
                    <input type="url" name="imageUrl" required placeholder="URL Imagen" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                    <textarea name="description" rows="2" required placeholder="Descripción..." class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"></textarea>
                    <button type="submit" class="w-full bg-cyan-500 text-slate-950 font-black uppercase py-2.5 rounded-xl text-xs hover:bg-cyan-400 transition">Publicar Producto</button>
                </form>
            </div>

            <div class="bg-[#0b0f19] border border-slate-800 p-6 rounded-3xl shadow-2xl">
                <h3 class="text-sm font-black text-white uppercase mb-4"><i class="fas fa-bullhorn text-cyan-400 mr-2"></i> Banner Promoción de Marcas</h3>
                <form action="/api/banners" method="POST" class="space-y-3">
                    <input type="text" name="title" required placeholder="Título (Ej: Asus / Intel Week)" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                    <input type="text" name="subtitle" required placeholder="Subtítulo promocional" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                    <input type="url" name="imageUrl" required placeholder="URL Imagen del Banner" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                    <input type="text" name="linkUrl" placeholder="Enlace (ej: #catalogo)" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400">
                    <button type="submit" class="w-full bg-slate-900 border border-slate-700 text-white font-black uppercase py-2.5 rounded-xl text-xs hover:bg-slate-800 transition">Crear Banner Marca</button>
                </form>
            </div>
        </div>
    </section>
    ` : ''}

    <!-- LOGIN / REGISTRO DE CLIENTES -->
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
            <h3 class="text-lg font-black text-white uppercase mb-4">Registro de Nuevo Cliente</h3>
            <form action="/api/register" method="POST" class="space-y-4">
                <input type="text" name="name" required placeholder="Nombre completo" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none">
                <input type="email" name="email" required placeholder="Correo electrónico" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none">
                <input type="password" name="password" required placeholder="Contraseña" class="w-full bg-[#030712] border border-slate-800 rounded-xl px-4 py-3 text-xs text-white outline-none">
                <button type="submit" class="w-full bg-cyan-500 text-slate-950 font-black uppercase py-3 rounded-xl text-xs hover:bg-cyan-400 transition">Registrarse</button>
            </form>
        </div>
    </section>
    ` : ''}

    <!-- FOOTER -->
    <footer class="bg-[#050811] text-slate-400 border-t border-slate-800 pt-16 pb-12 px-6 mt-16 text-xs text-center">
        <div class="flex justify-center space-x-4 mb-4 text-lg">
            ${settings.socialTwitter ? `<a href="${settings.socialTwitter}" target="_blank" class="text-slate-400 hover:text-cyan-400"><i class="fab fa-x-twitter"></i></a>` : ''}
            ${settings.socialInstagram ? `<a href="${settings.socialInstagram}" target="_blank" class="text-slate-400 hover:text-cyan-400"><i class="fab fa-instagram"></i></a>` : ''}
            ${settings.socialLinkedIn ? `<a href="${settings.socialLinkedIn}" target="_blank" class="text-slate-400 hover:text-cyan-400"><i class="fab faian-linkedin-in"></i></a>` : ''}
        </div>
        <p>${settings.brandName || 'GestionCloud'} E-Commerce & Solutions &copy; 2026. Todos los derechos reservados.</p>
        <p class="text-[10px] text-slate-500 mt-1">${settings.footerText || ''}</p>
    </footer>
</body>
</html>`;
}

module.exports = new StoreController();
