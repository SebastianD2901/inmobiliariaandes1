/* =========================================================
   Andina Propiedades — Lógica con Previsualización y Edición
   ========================================================= */

const PROPIEDADES_POR_DEFECTO = [
  {
    id: 1,
    creadorUid: null,
    titulo: "Casa familiar con jardín y estudio",
    operacion: "venta",
    tipo: "casa",
    ciudad: "Riobamba",
    sector: "La Primavera",
    precio: 129000,
    dormitorios: 4,
    banos: 3,
    area: 210,
    parqueaderos: 2,
    anio: 2019,
    destacada: true,
    ubicacionUrl: "https://maps.google.com/?q=-1.67098,-78.64712",
    descripcion: "Hermosa casa de dos plantas en conjunto cerrado con guardianía 24/7, amplias zonas verdes y acabados de primera.",
    caracteristicas: ["Conjunto cerrado", "Guardianía 24/7", "Área de asados", "Garaje techado"],
    asesor: { nombre: "Andina Propiedades", telefono: "593990000001" },
    galeria: [
      { tipo: "imagen", url: "img/propiedad-1-12.jpeg" }
    ]
  }
];

function cargarPropiedades() {
  const guardadas = localStorage.getItem("andina_propiedades");
  if (guardadas) {
    try {
      const parsed = JSON.parse(guardadas);
      return parsed.map(p => {
        if (p.galeria && typeof p.galeria[0] === "string") {
          p.galeria = p.galeria.map(url => ({
            tipo: url.startsWith("data:video") ? "video" : "imagen",
            url: url
          }));
        }
        return p;
      });
    } catch (e) {
      return PROPIEDADES_POR_DEFECTO;
    }
  }
  return PROPIEDADES_POR_DEFECTO;
}

let PROPIEDADES = cargarPropiedades();
let usuarioActual = null;
let propiedadEnBorrador = null; // Almacena temporalmente los datos para la previsualización

const $ = (sel) => document.querySelector(sel);
const money = (n) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const ETIQUETA_TIPO = { casa: "Casa", departamento: "Departamento", terreno: "Terreno", local: "Local" };

// ==========================================
// 1. GESTIÓN GLOBAL DE MODALES (CIERRE)
// ==========================================
function cerrarCualquierModal() {
  document.querySelectorAll(".modal").forEach(m => {
    m.hidden = true;
    m.querySelectorAll("video").forEach(v => v.pause());
  });
  document.body.classList.remove("sin-scroll");
  const authErr = $("#auth-error");
  if (authErr) authErr.textContent = "";
}

document.addEventListener("click", (e) => {
  const targetCerrar = e.target.closest("[data-cerrar]") || e.target.closest(".modal__cerrar");
  if (targetCerrar) {
    e.preventDefault();
    cerrarCualquierModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarCualquierModal();
});

// ==========================================
// 2. CONFIGURACIÓN FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDLlfRoXdcr92D6jIxBZ3ZyXwb2s0Qql6Y",
  authDomain: "los-andes-79222.firebaseapp.com",
  projectId: "los-andes-79222",
  storageBucket: "los-andes-79222.firebasestorage.app",
  messagingSenderId: "191492241490",
  appId: "1:191492241490:web:1db2a809ad4199fd2d478b",
  measurementId: "G-15MMH1VRE4"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ==========================================
// 3. ESTADO DE AUTENTICACIÓN
// ==========================================
auth.onAuthStateChanged(user => {
  usuarioActual = user;
  if (user) {
    $("#btn-login-modal").hidden = true;
    $("#btn-logout").hidden = false;
    $("#btn-publicar").hidden = false;
    cerrarCualquierModal();
  } else {
    $("#btn-login-modal").hidden = false;
    $("#btn-logout").hidden = true;
    $("#btn-publicar").hidden = true;
  }
  renderizarCatalogo(PROPIEDADES);
});

$("#btn-logout").addEventListener("click", () => auth.signOut());
$("#btn-login-modal").addEventListener("click", () => { 
  $("#modal-auth").hidden = false; 
  document.body.classList.add("sin-scroll");
});

$("#btn-google").addEventListener("click", () => {
  auth.signInWithPopup(googleProvider)
    .then(() => cerrarCualquierModal())
    .catch(err => {
      $("#auth-error").textContent = "Error al conectar con Google: " + err.message;
    });
});

// ==========================================
// 4. PREPARACIÓN Y FORMULARIO DE PUBLICACIÓN
// ==========================================
$("#btn-publicar").addEventListener("click", () => {
  prepararFormularioPublicacion(null);
  $("#modal-publicar").hidden = false; 
  document.body.classList.add("sin-scroll");
});

function prepararFormularioPublicacion(propiedadAEditar) {
  const form = $("#form-publicar");
  form.reset();

  if (propiedadAEditar) {
    $("#pub-modal-titulo").textContent = "Editar Inmueble";
    $("#pub-modal-sub").textContent = "Actualiza los datos y revisa la vista previa.";
    $("#btn-submit-pub").textContent = "Previsualizar Cambios";
    $("#pub-id-editar").value = propiedadAEditar.id;
    $("#pub-fotos").required = false;
    $("#lbl-fotos").textContent = "Reemplazar Fotos/Videos (Opcional)";

    $("#pub-titulo").value = propiedadAEditar.titulo;
    $("#pub-operacion").value = propiedadAEditar.operacion;
    $("#pub-tipo").value = propiedadAEditar.tipo;
    $("#pub-ciudad").value = propiedadAEditar.ciudad;
    $("#pub-sector").value = propiedadAEditar.sector;
    $("#pub-precio").value = propiedadAEditar.precio;
    $("#pub-dorm").value = propiedadAEditar.dormitorios;
    $("#pub-banos").value = propiedadAEditar.banos;
    $("#pub-area").value = propiedadAEditar.area;
    $("#pub-anio").value = propiedadAEditar.anio;
    $("#pub-mapa").value = propiedadAEditar.ubicacionUrl || "";
    $("#pub-wa").value = propiedadAEditar.asesor.telefono;
    $("#pub-desc").value = propiedadAEditar.descripcion;
    $("#pub-caract").value = (propiedadAEditar.caracteristicas || []).join(", ");
  } else {
    $("#pub-modal-titulo").textContent = "Publicar Inmueble";
    $("#pub-modal-sub").textContent = "Completa los datos. Podrás revisar la vista previa antes de publicar.";
    $("#btn-submit-pub").textContent = "Previsualizar publicación";
    $("#pub-id-editar").value = "";
    $("#pub-fotos").required = true;
    $("#lbl-fotos").textContent = "Fotos y Videos (Archivos multimedia) *";
  }
}

// Interceptar submit para abrir PREVISUALIZACIÓN
$("#form-publicar").addEventListener("submit", async (e) => {
  e.preventDefault();

  const idEditar = $("#pub-id-editar").value;
  const archivos = $("#pub-fotos").files;

  let galeriaItems = [];

  // Si se eligieron archivos nuevos
  if (archivos && archivos.length > 0) {
    const promesasMultimedia = Array.from(archivos).map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        const esVideo = file.type.startsWith("video/");
        reader.onload = (ev) => resolve({
          tipo: esVideo ? "video" : "imagen",
          url: ev.target.result
        });
        reader.readAsDataURL(file);
      });
    });
    galeriaItems = await Promise.all(promesasMultimedia);
  } else if (idEditar) {
    // Si estamos editando y no se subieron nuevas fotos, mantener las existentes
    const propExistente = PROPIEDADES.find(p => p.id === Number(idEditar));
    if (propExistente) {
      galeriaItems = propExistente.galeria;
    }
  }

  if (!galeriaItems || galeriaItems.length === 0) {
    alert("Por favor selecciona al menos una fotografía o video.");
    return;
  }

  // Crear objeto borrador
  propiedadEnBorrador = {
    id: idEditar ? Number(idEditar) : Date.now(),
    creadorUid: usuarioActual ? usuarioActual.uid : (idEditar ? PROPIEDADES.find(p => p.id === Number(idEditar))?.creadorUid : null),
    titulo: $("#pub-titulo").value.trim(),
    operacion: $("#pub-operacion").value,
    tipo: $("#pub-tipo").value,
    ciudad: $("#pub-ciudad").value.trim(),
    sector: $("#pub-sector").value.trim(),
    precio: Number($("#pub-precio").value),
    dormitorios: Number($("#pub-dorm").value) || 0,
    banos: Number($("#pub-banos").value) || 0,
    area: Number($("#pub-area").value) || 0,
    anio: Number($("#pub-anio").value) || 2024,
    ubicacionUrl: $("#pub-mapa").value.trim(),
    descripcion: $("#pub-desc").value.trim(),
    caracteristicas: $("#pub-caract").value ? $("#pub-caract").value.split(",").map(c => c.trim()).filter(Boolean) : [],
    asesor: {
      nombre: usuarioActual ? (usuarioActual.displayName || usuarioActual.email.split("@")[0]) : "Propietario",
      telefono: $("#pub-wa").value.replace(/\D/g, '')
    },
    galeria: galeriaItems,
    destacada: true,
    esEdicion: Boolean(idEditar)
  };

  // Mostrar modal de previsualización
  mostrarModalPreview(propiedadEnBorrador);
});

// Mostrar modal de vista previa
function mostrarModalPreview(p) {
  const mensajeWA = encodeURIComponent(`Hola, vi en Los Andes su anuncio "${p.titulo}". ¿Podría darme más información?`);

  $("#preview-contenido").innerHTML = `
    <div class="modal__imagen-wrap">
      ${generarHtmlCarrusel(p.galeria, `carrusel-preview`, true)}
      <span class="chip chip--operacion">${p.operacion === "venta" ? "En Venta" : "En Alquiler"}</span>
    </div>
    <div class="modal__detalles">
      <div class="modal__header-info">
        <span class="badge-tipo">${ETIQUETA_TIPO[p.tipo] || p.tipo}</span>
        <h2>${p.titulo}</h2>
        <p class="modal__ubicacion">${p.sector}, ${p.ciudad}</p>
        <p class="modal__precio">${money(p.precio)}</p>
      </div>

      <ul class="tarjeta__detalles modal__specs">
        ${p.dormitorios ? `<li><strong>${p.dormitorios}</strong> Dormitorios</li>` : ''}
        ${p.banos ? `<li><strong>${p.banos}</strong> Baños</li>` : ''}
        ${p.area ? `<li><strong>${p.area}</strong> m² Área</li>` : ''}
        ${p.anio ? `<li>Año: <strong>${p.anio}</strong></li>` : ''}
      </ul>

      <div class="modal__bloque">
        <h3>Descripción</h3>
        <p>${p.descripcion}</p>
      </div>

      ${p.caracteristicas && p.caracteristicas.length ? `
        <div class="modal__bloque">
          <h3>Comodidades</h3>
          <div class="modal__tags">
            ${p.caracteristicas.map(c => `<span>✓ ${c}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <div class="modal__acciones-contacto">
        ${p.ubicacionUrl ? `
          <a class="btn btn--secundario btn--full" href="${p.ubicacionUrl}" target="_blank" rel="noopener">
            📍 Ver Ubicación en el Mapa
          </a>
        ` : ''}
        <a class="btn btn--wa btn--full" href="https://wa.me/${p.asesor.telefono}?text=${mensajeWA}" target="_blank" rel="noopener">
          Contactar por WhatsApp
        </a>
      </div>
    </div>
  `;

  $("#modal-publicar").hidden = true;
  $("#modal-preview").hidden = false;
}

// Botón "Volver a editar" en previsualización
$("#btn-preview-volver").addEventListener("click", () => {
  $("#modal-preview").hidden = true;
  $("#modal-publicar").hidden = false;
});

// Botón "Confirmar y Publicar" en previsualización
$("#btn-preview-confirmar").addEventListener("click", () => {
  if (!propiedadEnBorrador) return;

  const p = propiedadEnBorrador;

  if (p.esEdicion) {
    const idx = PROPIEDADES.findIndex(item => item.id === p.id);
    if (idx !== -1) {
      delete p.esEdicion;
      PROPIEDADES[idx] = p;
      alert("¡Publicación actualizada exitosamente!");
    }
  } else {
    delete p.esEdicion;
    PROPIEDADES.unshift(p);
    alert("¡Tu propiedad ha sido publicada exitosamente!");
  }

  localStorage.setItem("andina_propiedades", JSON.stringify(PROPIEDADES));
  renderizarCatalogo(PROPIEDADES);
  cerrarCualquierModal();
  propiedadEnBorrador = null;
  $("#form-publicar").reset();
});

// ==========================================
// 5. MOTOR DEL CARRUSEL (SLIDER INTERACTIVO)
// ==========================================
function generarHtmlCarrusel(galeria, idContenedor, esModal = false) {
  if (!galeria || galeria.length === 0) {
    return `<div class="carrusel-slide activo"><img src="img/propiedad-1-12.jpeg" alt="Sin imagen"></div>`;
  }

  const slides = galeria.map((item, index) => {
    const esPrimerSlide = index === 0 ? "activo" : "";
    if (item.tipo === "video") {
      return `
        <div class="carrusel-slide ${esPrimerSlide}" data-slide="${index}">
          <video ${esModal ? 'controls' : 'muted loop playsinline'} class="carrusel-media">
            <source src="${item.url}">
            Tu navegador no soporta video.
          </video>
          <span class="badge-multimedia">▶ Video</span>
        </div>
      `;
    }
    return `
      <div class="carrusel-slide ${esPrimerSlide}" data-slide="${index}">
        <img src="${item.url}" class="carrusel-media" alt="Inmueble">
      </div>
    `;
  }).join("");

  const controles = galeria.length > 1 ? `
    <button type="button" class="carrusel-btn prev" data-carrusel="${idContenedor}" data-dir="-1" aria-label="Anterior">&#10094;</button>
    <button type="button" class="carrusel-btn next" data-carrusel="${idContenedor}" data-dir="1" aria-label="Siguiente">&#10095;</button>
    <span class="carrusel-contador">1 / ${galeria.length}</span>
  ` : "";

  return `
    <div class="carrusel" id="${idContenedor}">
      ${slides}
      ${controles}
    </div>
  `;
}

function cambiarSlide(carruselEl, direccion) {
  const slides = carruselEl.querySelectorAll(".carrusel-slide");
  if (slides.length <= 1) return;

  let indiceActual = Array.from(slides).findIndex(s => s.classList.contains("activo"));
  if (indiceActual === -1) indiceActual = 0;

  // Pausar video si estaba reproduciéndose
  const videoActual = slides[indiceActual].querySelector("video");
  if (videoActual) videoActual.pause();

  slides[indiceActual].classList.remove("activo");

  let nuevoIndice = indiceActual + direccion;
  if (nuevoIndice >= slides.length) nuevoIndice = 0;
  if (nuevoIndice < 0) nuevoIndice = slides.length - 1;

  slides[nuevoIndice].classList.add("activo");

  // Si el nuevo slide tiene video en vista de tarjeta, auto-reproducir silenciado
  const videoNuevo = slides[nuevoIndice].querySelector("video");
  if (videoNuevo && !videoNuevo.hasAttribute("controls")) {
    videoNuevo.play().catch(() => {});
  }

  const contador = carruselEl.querySelector(".carrusel-contador");
  if (contador) {
    contador.textContent = `${nuevoIndice + 1} / ${slides.length}`;
  }
}

// Clic en botones del carrusel
document.addEventListener("click", (e) => {
  const btnCarrusel = e.target.closest(".carrusel-btn");
  if (btnCarrusel) {
    e.preventDefault();
    e.stopPropagation();
    const carrusel = btnCarrusel.closest(".carrusel");
    const dir = Number(btnCarrusel.dataset.dir);
    cambiarSlide(carrusel, dir);
  }
});

// ==========================================
// 6. RENDERIZADO DE CATÁLOGO Y TARJETAS
// ==========================================
function renderizarCatalogo(lista) {
  const grilla = $("#grilla-propiedades");
  if (lista.length === 0) {
    grilla.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--c-texto-suave); padding: 3rem 0;">No se encontraron inmuebles.</p>`;
    return;
  }

  grilla.innerHTML = lista.map(p => {
    // Si el usuario actual es el autor de la publicación
    const esPropietario = Boolean(usuarioActual && p.creadorUid && usuarioActual.uid === p.creadorUid);

    return `
      <article class="tarjeta" data-id="${p.id}">
        <div class="tarjeta__portada">
          ${generarHtmlCarrusel(p.galeria, `carrusel-tarjeta-${p.id}`)}
          <span class="chip chip--operacion">${p.operacion === "venta" ? "En Venta" : "En Alquiler"}</span>
          ${p.destacada ? '<span class="chip chip--destacada">Destacada</span>' : ''}
          
          <div class="tarjeta__acciones-superiores">
            ${esPropietario ? `<button type="button" class="btn-tarjeta-accion btn-tarjeta-editar" data-editar="${p.id}">✎ Editar</button>` : ''}
            ${p.ubicacionUrl ? `<a href="${p.ubicacionUrl}" target="_blank" rel="noopener" class="btn-tarjeta-accion btn-tarjeta-mapa" data-stop-propagation="true">📍 Mapa</a>` : ''}
          </div>
        </div>
        <div class="tarjeta__cuerpo">
          <div class="tarjeta__precio-fila">
            <span class="tarjeta__precio">${money(p.precio)}</span>
            <span class="badge-tipo">${ETIQUETA_TIPO[p.tipo] || p.tipo}</span>
          </div>
          <h3 class="tarjeta__titulo">${p.titulo}</h3>
          <p class="tarjeta__sector">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            ${p.sector}, ${p.ciudad}
          </p>
          
          <ul class="tarjeta__detalles">
            ${p.dormitorios > 0 ? `<li><strong>${p.dormitorios}</strong> habs.</li>` : ''}
            ${p.banos > 0 ? `<li><strong>${p.banos}</strong> baños</li>` : ''}
            ${p.area > 0 ? `<li><strong>${p.area}</strong> m²</li>` : ''}
            ${p.anio ? `<li>Año <strong>${p.anio}</strong></li>` : ''}
          </ul>
        </div>
      </article>
    `;
  }).join("");
}

// Clic dentro de la grilla de propiedades
$("#grilla-propiedades").addEventListener("click", (e) => {
  // Evitar abrir modal si hizo clic en controles del carrusel o enlace directo al mapa
  if (e.target.closest(".carrusel-btn") || e.target.closest('[data-stop-propagation="true"]')) {
    return;
  }

  // Si hizo clic en editar desde la tarjeta
  const btnEditar = e.target.closest("[data-editar]");
  if (btnEditar) {
    e.stopPropagation();
    const id = Number(btnEditar.dataset.editar);
    const p = PROPIEDADES.find(x => x.id === id);
    if (p) {
      prepararFormularioPublicacion(p);
      $("#modal-publicar").hidden = false;
      document.body.classList.add("sin-scroll");
    }
    return;
  }

  // Abrir detalle completo de la propiedad
  const tarjeta = e.target.closest(".tarjeta");
  if (!tarjeta) return;
  const p = PROPIEDADES.find(x => x.id === Number(tarjeta.dataset.id));
  if (!p) return;

  const esPropietario = Boolean(usuarioActual && p.creadorUid && usuarioActual.uid === p.creadorUid);
  const mensajeWA = encodeURIComponent(`Hola, vi en Los Andes su anuncio "${p.titulo}" por ${money(p.precio)}. ¿Podría darme más información?`);

  $("#modal-contenido").innerHTML = `
    <div class="modal__imagen-wrap">
      ${generarHtmlCarrusel(p.galeria, `carrusel-modal-${p.id}`, true)}
      <span class="chip chip--operacion">${p.operacion === "venta" ? "En Venta" : "En Alquiler"}</span>
    </div>
    <div class="modal__detalles">
      <div class="modal__header-info">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <span class="badge-tipo">${ETIQUETA_TIPO[p.tipo] || p.tipo}</span>
          ${esPropietario ? `<button type="button" class="btn btn--secundario btn--sm" id="btn-modal-editar">✎ Editar mi publicación</button>` : ''}
        </div>
        <h2>${p.titulo}</h2>
        <p class="modal__ubicacion">${p.sector}, ${p.ciudad}</p>
        <p class="modal__precio">${money(p.precio)}</p>
      </div>

      <ul class="tarjeta__detalles modal__specs">
        ${p.dormitorios ? `<li><strong>${p.dormitorios}</strong> Dormitorios</li>` : ''}
        ${p.banos ? `<li><strong>${p.banos}</strong> Baños</li>` : ''}
        ${p.area ? `<li><strong>${p.area}</strong> m² Área</li>` : ''}
        ${p.anio ? `<li>Año: <strong>${p.anio}</strong></li>` : ''}
      </ul>

      <div class="modal__bloque">
        <h3>Descripción</h3>
        <p>${p.descripcion}</p>
      </div>

      ${p.caracteristicas && p.caracteristicas.length ? `
        <div class="modal__bloque">
          <h3>Comodidades</h3>
          <div class="modal__tags">
            ${p.caracteristicas.map(c => `<span>✓ ${c}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <div class="modal__acciones-contacto">
        ${p.ubicacionUrl ? `
          <a class="btn btn--secundario btn--full" href="${p.ubicacionUrl}" target="_blank" rel="noopener">
            📍 Ver Ubicación en el Mapa
          </a>
        ` : ''}
        <a class="btn btn--wa btn--full" href="https://wa.me/${p.asesor.telefono}?text=${mensajeWA}" target="_blank" rel="noopener">
          Contactar por WhatsApp
        </a>
      </div>
    </div>
  `;

  const btnModalEditar = $("#btn-modal-editar");
  if (btnModalEditar) {
    btnModalEditar.addEventListener("click", () => {
      cerrarCualquierModal();
      prepararFormularioPublicacion(p);
      $("#modal-publicar").hidden = false;
      document.body.classList.add("sin-scroll");
    });
  }

  $("#modal").hidden = false;
  document.body.classList.add("sin-scroll");
});

// ==========================================
// 7. SIMULADOR HIPOTECARIO
// ==========================================
function calcularSimulador() {
  const monto = Number($("#sim-monto").value) || 0;
  const anios = Number($("#sim-plazo").value) || 20;
  const tasaAnual = Number($("#sim-tasa").value) || 8.5;

  const n = anios * 12;
  const r = (tasaAnual / 100) / 12;

  let cuota = 0;
  if (r > 0 && n > 0 && monto > 0) {
    cuota = monto * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  const total = cuota * n;

  $("#res-cuota").textContent = money(cuota);
  $("#res-monto").textContent = money(monto);
  $("#res-plazo").textContent = `${anios} años (${n} meses)`;
  $("#res-total").textContent = money(total);
}

$("#form-simulador").addEventListener("submit", (e) => {
  e.preventDefault();
  calcularSimulador();
});

// ==========================================
// 8. BUSCADOR Y TEMA
// ==========================================
$("#f-precio").addEventListener("input", (e) => {
  $("#salida-precio").value = money(Number(e.target.value));
});

$("#form-busqueda").addEventListener("submit", (e) => {
  e.preventDefault();
  const operacion = $("#f-operacion").value;
  const tipo = $("#f-tipo").value;
  const texto = $("#f-texto").value.toLowerCase().trim();
  const maxPrecio = Number($("#f-precio").value);

  const filtrados = PROPIEDADES.filter(p => {
    const coincideOp = !operacion || p.operacion === operacion;
    const coincideTipo = !tipo || p.tipo === tipo;
    const coincidePrecio = p.precio <= maxPrecio;
    const coincideTexto = !texto || 
      p.titulo.toLowerCase().includes(texto) ||
      p.sector.toLowerCase().includes(texto) ||
      p.ciudad.toLowerCase().includes(texto) ||
      p.descripcion.toLowerCase().includes(texto);

    return coincideOp && coincideTipo && coincidePrecio && coincideTexto;
  });

  renderizarCatalogo(filtrados);
});

$("#btn-tema").addEventListener("click", () => {
  const actual = document.documentElement.getAttribute("data-theme");
  document.documentElement.setAttribute("data-theme", actual === "dark" ? "light" : "dark");
});

// Inicialización
renderizarCatalogo(PROPIEDADES);
calcularSimulador();