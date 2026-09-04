/* =========================================================
   Andina Propiedades — Lógica Estable sin Recargas
   ========================================================= */

const $ = (sel) => document.querySelector(sel);
const money = (n) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const ETIQUETA_TIPO = { casa: "Casa", departamento: "Departamento", terreno: "Terreno", local: "Local" };

const PROPIEDAD_DEMO = {
  id: "demo-inicial",
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
  anio: 2019,
  destacada: true,
  estado: "disponible",
  ubicacionUrl: "https://maps.google.com/?q=-1.67098,-78.64712",
  descripcion: "Hermosa casa de dos plantas en conjunto cerrado con guardianía 24/7, amplias zonas verdes y acabados de primera.",
  caracteristicas: ["Conjunto cerrado", "Guardianía 24/7", "Área de asados", "Garaje techado"],
  asesor: { nombre: "Andina Propiedades", telefono: "593990000001" },
  galeria: [{ tipo: "imagen", url: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop&q=60" }]
};

// ==========================================
// 1. FIREBASE CONFIGURACIÓN
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

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

let PROPIEDADES = [];
let usuarioActual = null;
let propiedadEnBorrador = null;

// ==========================================
// 2. SINCRONIZACIÓN PERSISTENTE FIRESTORE
// ==========================================
db.collection("propiedades").onSnapshot(
  (snapshot) => {
    if (!snapshot.empty) {
      PROPIEDADES = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      PROPIEDADES.sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));
    } else {
      PROPIEDADES = [PROPIEDAD_DEMO];
    }
    renderizarCatalogo(PROPIEDADES);
  },
  (err) => {
    console.error("Fallo al escuchar Firestore:", err);
  }
);

// ==========================================
// 3. COMPRESIÓN DE IMÁGENES
// ==========================================
function comprimirImagen(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxMedida = 700;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxMedida) {
            height = Math.round((height * maxMedida) / width);
            width = maxMedida;
          }
        } else {
          if (height > maxMedida) {
            width = Math.round((width * maxMedida) / height);
            height = maxMedida;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        resolve({
          tipo: "imagen",
          url: canvas.toDataURL("image/jpeg", 0.6)
        });
      };
      img.onerror = () => resolve({ tipo: "imagen", url: event.target.result });
    };
  });
}

// ==========================================
// 4. AUTENTICACIÓN GOOGLE
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
      $("#auth-error").textContent = "Error: " + err.message;
    });
});

// ==========================================
// 5. GESTIÓN DE MODALES
// ==========================================
function cerrarCualquierModal() {
  document.querySelectorAll(".modal").forEach(m => {
    m.hidden = true;
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
// 6. FORMULARIO, PREVIEW Y GUARDADO REAL
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
    $("#pub-modal-sub").textContent = "Actualiza los datos y confirma en la vista previa.";
    $("#btn-submit-pub").textContent = "Previsualizar Cambios";
    $("#pub-id-editar").value = propiedadAEditar.id;
    $("#pub-fotos").required = false;
    $("#lbl-fotos").textContent = "Reemplazar Fotos (Opcional)";

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
    $("#pub-modal-sub").textContent = "Completa los datos de tu propiedad para el catálogo.";
    $("#btn-submit-pub").textContent = "Previsualizar publicación";
    $("#pub-id-editar").value = "";
    $("#pub-fotos").required = true;
    $("#lbl-fotos").textContent = "Fotos (Archivos JPG o PNG) *";
  }
}

// 1er paso: Previsualizar
$("#form-publicar").addEventListener("submit", async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const idEditar = $("#pub-id-editar").value;
  const archivos = $("#pub-fotos").files;

  let galeriaItems = [];

  if (archivos && archivos.length > 0) {
    const promesas = Array.from(archivos).map(file => comprimirImagen(file));
    galeriaItems = await Promise.all(promesas);
  } else if (idEditar) {
    const propExistente = PROPIEDADES.find(p => String(p.id) === String(idEditar));
    if (propExistente) {
      galeriaItems = propExistente.galeria;
    }
  }

  if (!galeriaItems || galeriaItems.length === 0) {
    alert("Por favor selecciona al menos una fotografía.");
    return;
  }

  propiedadEnBorrador = {
    id: idEditar || null,
    creadorUid: usuarioActual ? usuarioActual.uid : (idEditar ? PROPIEDADES.find(p => String(p.id) === String(idEditar))?.creadorUid : null),
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
    estado: "disponible",
    asesor: {
      nombre: usuarioActual ? (usuarioActual.displayName || usuarioActual.email.split("@")[0]) : "Propietario",
      telefono: $("#pub-wa").value.replace(/\D/g, '')
    },
    galeria: galeriaItems,
    destacada: true,
    creadoEn: Date.now(),
    esEdicion: Boolean(idEditar)
  };

  mostrarModalPreview(propiedadEnBorrador);
});

function mostrarModalPreview(p) {
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
    </div>
  `;

  $("#modal-publicar").hidden = true;
  $("#modal-preview").hidden = false;
}

$("#btn-preview-volver").addEventListener("click", (e) => {
  e.preventDefault();
  $("#modal-preview").hidden = true;
  $("#modal-publicar").hidden = false;
});

// 2do paso: Confirmar y guardar sin recargar
$("#btn-preview-confirmar").addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (!propiedadEnBorrador) return;

  const btnConfirmar = $("#btn-preview-confirmar");
  btnConfirmar.disabled = true;
  btnConfirmar.textContent = "Guardando...";

  const p = { ...propiedadEnBorrador };
  const esEdicion = p.esEdicion;
  const idDoc = p.id;
  delete p.esEdicion;

  try {
    if (esEdicion && idDoc) {
      delete p.id;
      await db.collection("propiedades").doc(String(idDoc)).set(p, { merge: true });
    } else {
      delete p.id;
      await db.collection("propiedades").add(p);
    }

    cerrarCualquierModal();
    propiedadEnBorrador = null;
    $("#form-publicar").reset();
    alert("¡Publicación guardada exitosamente en la nube!");
  } catch (err) {
    console.error("Error al escribir en Firestore:", err);
    alert("Error de Firebase: " + err.message);
  } finally {
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = "Confirmar y Publicar";
  }
});

// ==========================================
// 7. GESTIÓN: ESTADO Y ELIMINACIÓN
// ==========================================
async function cambiarEstadoPropiedad(id, nuevoEstado) {
  try {
    await db.collection("propiedades").doc(String(id)).update({ estado: nuevoEstado });
  } catch (e) {
    alert("Error al actualizar estado: " + e.message);
  }
}

async function eliminarPropiedad(id) {
  if (!confirm("¿Deseas eliminar definitivamente esta publicación?")) return;

  try {
    await db.collection("propiedades").doc(String(id)).delete();
    cerrarCualquierModal();
    alert("Publicación eliminada.");
  } catch (e) {
    alert("Error al eliminar: " + e.message);
  }
}

// ==========================================
// 8. CARRUSEL
// ==========================================
function generarHtmlCarrusel(galeria, idContenedor, esModal = false) {
  if (!galeria || galeria.length === 0) {
    return `<div class="carrusel-slide activo"><img src="https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800" alt="Sin imagen"></div>`;
  }

  const slides = galeria.map((item, index) => {
    const esPrimerSlide = index === 0 ? "activo" : "";
    return `
      <div class="carrusel-slide ${esPrimerSlide}" data-slide="${index}">
        <img src="${item.url}" class="carrusel-media" alt="Inmueble">
      </div>
    `;
  }).join("");

  const controles = galeria.length > 1 ? `
    <button type="button" class="carrusel-btn prev" data-dir="-1" aria-label="Anterior">&#10094;</button>
    <button type="button" class="carrusel-btn next" data-dir="1" aria-label="Siguiente">&#10095;</button>
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

  slides[indiceActual].classList.remove("activo");

  let nuevoIndice = indiceActual + direccion;
  if (nuevoIndice >= slides.length) nuevoIndice = 0;
  if (nuevoIndice < 0) nuevoIndice = slides.length - 1;

  slides[nuevoIndice].classList.add("activo");

  const contador = carruselEl.querySelector(".carrusel-contador");
  if (contador) {
    contador.textContent = `${nuevoIndice + 1} / ${slides.length}`;
  }
}

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
// 9. RENDERIZADO DEL CATÁLOGO
// ==========================================
function renderizarCatalogo(lista) {
  const grilla = $("#grilla-propiedades");
  if (!grilla) return;

  if (!lista || lista.length === 0) {
    grilla.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--c-texto-suave); padding: 3rem 0;">No se encontraron inmuebles.</p>`;
    return;
  }

  grilla.innerHTML = lista.map(p => {
    const esPropietario = Boolean(usuarioActual && p.creadorUid && usuarioActual.uid === p.creadorUid);
    const estaVendidoOAlquilado = p.estado === "vendido" || p.estado === "alquilado";

    return `
      <article class="tarjeta ${estaVendidoOAlquilado ? 'tarjeta--cerrada' : ''}" data-id="${p.id}">
        <div class="tarjeta__portada">
          ${generarHtmlCarrusel(p.galeria, `carrusel-tarjeta-${p.id}`)}
          
          <div class="tarjeta__chips-superiores">
            <span class="chip chip--operacion">${p.operacion === "venta" ? "En Venta" : "En Alquiler"}</span>
            ${p.estado === "vendido" ? '<span class="chip chip--estado chip--vendido">VENDIDO</span>' : ''}
            ${p.estado === "alquilado" ? '<span class="chip chip--estado chip--alquilado">ALQUILADO</span>' : ''}
            ${p.destacada && !estaVendidoOAlquilado ? '<span class="chip chip--destacada">Destacada</span>' : ''}
          </div>
          
          <div class="tarjeta__acciones-superiores">
            ${esPropietario ? `<button type="button" class="btn-tarjeta-accion btn-tarjeta-editar" data-editar="${p.id}">✎ Gestionar</button>` : ''}
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

// Clic en tarjetas
$("#grilla-propiedades").addEventListener("click", (e) => {
  if (e.target.closest(".carrusel-btn") || e.target.closest('[data-stop-propagation="true"]')) return;

  const btnEditar = e.target.closest("[data-editar]");
  if (btnEditar) {
    e.stopPropagation();
    const id = btnEditar.dataset.editar;
    const p = PROPIEDADES.find(x => String(x.id) === String(id));
    if (p) abrirModalDetalle(p);
    return;
  }

  const tarjeta = e.target.closest(".tarjeta");
  if (!tarjeta) return;
  const p = PROPIEDADES.find(x => String(x.id) === String(tarjeta.dataset.id));
  if (!p) return;

  abrirModalDetalle(p);
});

function abrirModalDetalle(p) {
  const esPropietario = Boolean(usuarioActual && p.creadorUid && usuarioActual.uid === p.creadorUid);
  const estaCerrado = p.estado === "vendido" || p.estado === "alquilado";
  const mensajeWA = encodeURIComponent(`Hola, vi en Los Andes su anuncio "${p.titulo}" por ${money(p.precio)}. ¿Sigue disponible?`);

  $("#modal-contenido").innerHTML = `
    <div class="modal__imagen-wrap">
      ${generarHtmlCarrusel(p.galeria, `carrusel-modal-${p.id}`, true)}
      <span class="chip chip--operacion">${p.operacion === "venta" ? "En Venta" : "En Alquiler"}</span>
      ${estaCerrado ? `<span class="chip chip--estado chip--${p.estado}">${p.estado.toUpperCase()}</span>` : ''}
    </div>
    
    <div class="modal__detalles">
      ${esPropietario ? `
        <div class="panel-propietario">
          <div class="panel-propietario__head">
            <strong>⚙️ Panel de Control del Propietario</strong>
          </div>
          <div class="panel-propietario__botones">
            <button type="button" class="btn btn--secundario btn--sm" id="btn-prop-editar">✎ Editar Información</button>
            <button type="button" class="btn btn--secundario btn--sm" id="btn-prop-estado">
              ${p.estado === 'disponible' ? `Marcar como ${p.operacion === 'venta' ? 'Vendido' : 'Alquilado'}` : 'Reactivar (Disponible)'}
            </button>
            <button type="button" class="btn btn--peligro btn--sm" id="btn-prop-eliminar">🗑 Eliminar Anuncio</button>
          </div>
        </div>
      ` : ''}

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

      <div class="modal__acciones-contacto">
        ${p.ubicacionUrl ? `
          <a class="btn btn--secundario btn--full" href="${p.ubicacionUrl}" target="_blank" rel="noopener">
            📍 Ver Ubicación en Google Maps
          </a>
        ` : ''}
        ${!estaCerrado ? `
          <a class="btn btn--wa btn--full" href="https://wa.me/${p.asesor.telefono}?text=${mensajeWA}" target="_blank" rel="noopener">
            Contactar por WhatsApp
          </a>
        ` : `
          <div class="aviso-cerrado">Esta propiedad ya se encuentra ${p.estado}.</div>
        `}
      </div>
    </div>
  `;

  if (esPropietario) {
    $("#btn-prop-editar").addEventListener("click", () => {
      cerrarCualquierModal();
      prepararFormularioPublicacion(p);
      $("#modal-publicar").hidden = false;
      document.body.classList.add("sin-scroll");
    });

    $("#btn-prop-estado").addEventListener("click", () => {
      const nuevoEstado = p.estado === "disponible" ? (p.operacion === "venta" ? "vendido" : "alquilado") : "disponible";
      cambiarEstadoPropiedad(String(p.id), nuevoEstado);
      cerrarCualquierModal();
    });

    $("#btn-prop-eliminar").addEventListener("click", () => {
      eliminarPropiedad(String(p.id));
    });
  }

  $("#modal").hidden = false;
  document.body.classList.add("sin-scroll");
}

// ==========================================
// 10. SIMULADOR HIPOTECARIO
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
// 11. BUSCADOR Y TEMA
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

calcularSimulador();