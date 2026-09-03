/* =========================================================
   Andina Propiedades — Lógica Principal
   ========================================================= */

const PROPIEDADES_POR_DEFECTO = [
  {
    id: 1,
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
    descripcion: "Casa amplia de dos plantas con acabados de primera, sala de estar, patio posterior con césped sintético y seguridad privada permanente.",
    caracteristicas: ["Conjunto cerrado", "Guardianía 24/7", "Área de asados", "Garaje techado"],
    asesor: { nombre: "Andina Propiedades", telefono: "593990000001" },
    galeria: ["img/propiedad-1-12.jpeg"]
  }
];

function cargarPropiedades() {
  const guardadas = localStorage.getItem("andina_propiedades");
  if (guardadas) {
    try {
      return JSON.parse(guardadas);
    } catch (e) {
      return PROPIEDADES_POR_DEFECTO;
    }
  }
  return PROPIEDADES_POR_DEFECTO;
}

let PROPIEDADES = cargarPropiedades();

const $ = (sel) => document.querySelector(sel);
const money = (n) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const ETIQUETA_TIPO = { casa: "Casa", departamento: "Departamento", terreno: "Terreno", local: "Local" };

// ==========================================
// 1. GESTIÓN GLOBAL DE MODALES (CIERRE EFECTIVO)
// ==========================================
function cerrarCualquierModal() {
  document.querySelectorAll(".modal").forEach(m => {
    m.hidden = true;
  });
  document.body.classList.remove("sin-scroll");
  const authErr = $("#auth-error");
  if (authErr) authErr.textContent = "";
}

// Delegación global: cualquier clic sobre un elemento con data-cerrar o botón .modal__cerrar
document.addEventListener("click", (e) => {
  const targetCerrar = e.target.closest("[data-cerrar]") || e.target.closest(".modal__cerrar");
  if (targetCerrar) {
    e.preventDefault();
    cerrarCualquierModal();
  }
});

// Cerrar con tecla Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    cerrarCualquierModal();
  }
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
// 3. ESTADO DE SESIÓN (SOLO GOOGLE)
// ==========================================
auth.onAuthStateChanged(user => {
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
      $("#auth-error").textContent = "Error al iniciar sesión: " + err.message;
    });
});

// ==========================================
// 4. PUBLICACIÓN DE INMUEBLES
// ==========================================
$("#btn-publicar").addEventListener("click", () => { 
  $("#modal-publicar").hidden = false; 
  document.body.classList.add("sin-scroll");
});

$("#form-publicar").addEventListener("submit", async (e) => {
  e.preventDefault();

  const archivos = $("#pub-fotos").files;
  if (!archivos || archivos.length === 0) {
    alert("Por favor selecciona al menos una fotografía del inmueble.");
    return;
  }

  const promesasFotos = Array.from(archivos).map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.readAsDataURL(file);
    });
  });
  const galeriaBase64 = await Promise.all(promesasFotos);

  const nuevaPropiedad = {
    id: Date.now(),
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
    descripcion: $("#pub-desc").value.trim(),
    caracteristicas: $("#pub-caract").value ? $("#pub-caract").value.split(",").map(c => c.trim()).filter(Boolean) : [],
    asesor: {
      nombre: auth.currentUser ? auth.currentUser.displayName || auth.currentUser.email.split("@")[0] : "Propietario",
      telefono: $("#pub-wa").value.replace(/\D/g, '')
    },
    galeria: galeriaBase64,
    destacada: true
  };

  PROPIEDADES.unshift(nuevaPropiedad);
  localStorage.setItem("andina_propiedades", JSON.stringify(PROPIEDADES));

  renderizarCatalogo(PROPIEDADES);
  cerrarCualquierModal();
  $("#form-publicar").reset();
  alert("¡Tu propiedad ha sido publicada exitosamente!");
});

// ==========================================
// 5. RENDERIZADO DE CATÁLOGO Y DETALLES
// ==========================================
function renderizarCatalogo(lista) {
  const grilla = $("#grilla-propiedades");
  if (lista.length === 0) {
    grilla.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--c-texto-suave); padding: 3rem 0;">No se encontraron inmuebles que coincidan con tu búsqueda.</p>`;
    return;
  }

  grilla.innerHTML = lista.map(p => `
    <article class="tarjeta" data-id="${p.id}">
      <div class="tarjeta__portada">
        <img class="tarjeta__imagen" src="${p.galeria[0]}" alt="${p.titulo}">
        <span class="chip chip--operacion">${p.operacion === "venta" ? "En Venta" : "En Alquiler"}</span>
        ${p.destacada ? '<span class="chip chip--destacada">Destacada</span>' : ''}
        <div class="tarjeta__portada-sombra"></div>
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
  `).join("");
}

// Clic en propiedad -> abrir modal
$("#grilla-propiedades").addEventListener("click", (e) => {
  const tarjeta = e.target.closest(".tarjeta");
  if (!tarjeta) return;
  const p = PROPIEDADES.find(x => x.id === Number(tarjeta.dataset.id));
  if (!p) return;

  const mensajeWA = encodeURIComponent(`Hola, vi en Los Andes su anuncio de "${p.titulo}" por ${money(p.precio)}. ¿Podría darme más información?`);

  $("#modal-contenido").innerHTML = `
    <div class="modal__imagen-wrap">
      <img src="${p.galeria[0]}" alt="${p.titulo}">
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

      <a class="btn btn--wa btn--full" href="https://wa.me/${p.asesor.telefono}?text=${mensajeWA}" target="_blank" rel="noopener">
        Contactar directamente por WhatsApp
      </a>
    </div>
  `;
  $("#modal").hidden = false;
  document.body.classList.add("sin-scroll");
});

// ==========================================
// 6. SIMULADOR HIPOTECARIO (SISTEMA FRANCÉS)
// ==========================================
function calcularSimulador() {
  const monto = Number($("#sim-monto").value) || 0;
  const anios = Number($("#sim-plazo").value) || 20;
  const tasaAnual = Number($("#sim-tasa").value) || 8.5;

  const n = anios * 12; // meses
  const r = (tasaAnual / 100) / 12; // tasa mensual

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
// 7. BUSCADOR Y TEMA
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

// Alternar tema oscuro/claro
$("#btn-tema").addEventListener("click", () => {
  const actual = document.documentElement.getAttribute("data-theme");
  document.documentElement.setAttribute("data-theme", actual === "dark" ? "light" : "dark");
});

// Inicialización
renderizarCatalogo(PROPIEDADES);
calcularSimulador();