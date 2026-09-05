/* =========================================================
   Andina Propiedades — Perfiles Duales, Chat y Mensajería
   ========================================================= */

const CLOUDINARY_CLOUD_NAME = "ipe9us2o"; 
const CLOUDINARY_UPLOAD_PRESET = "andina_preset"; 

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
  destacada: true,
  estado: "disponible",
  ubicacionUrl: "https://maps.google.com/?q=-1.67098,-78.64712",
  descripcion: "Hermosa casa de dos plantas en conjunto cerrado con guardianía 24/7, amplias zonas verdes y acabados de primera.",
  caracteristicas: ["Conjunto cerrado", "Guardianía 24/7", "Área de asados", "Garaje techado", "Gas centralizado"],
  asesorNombre: "Andina Propiedades",
  asesorTelefono: "593990000001",
  galeria: ["https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop&q=60"]
};

// ==========================================
// 1. RUTAS SPA
// ==========================================
function cambiarVista(vistaId) {
  document.querySelectorAll(".vista").forEach(v => {
    v.classList.remove("vista--activa");
  });

  const vistaDestino = document.getElementById(`vista-${vistaId}`);
  if (vistaDestino) {
    vistaDestino.classList.add("vista--activa");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll(".nav__enlace").forEach(enlace => {
    enlace.classList.toggle("activo", enlace.dataset.navegar === vistaId);
  });

  document.querySelectorAll(".barra-movil__item").forEach(item => {
    item.classList.toggle("activo", item.dataset.navegar === vistaId);
  });

  if (vistaId === "mis-propiedades") {
    renderizarMisPropiedades();
  }
}

document.addEventListener("click", (e) => {
  const targetNavegar = e.target.closest("[data-navegar]");
  if (targetNavegar) {
    e.preventDefault();
    const vista = targetNavegar.dataset.navegar;
    cambiarVista(vista);
    history.pushState(null, null, `#${vista}`);
  }
});

window.addEventListener("popstate", () => {
  const hash = window.location.hash.replace("#", "") || "inicio";
  cambiarVista(hash);
});

$("#btn-hero-publicar").addEventListener("click", () => {
  if (usuarioActual) {
    prepararFormularioPublicacion(null);
    $("#modal-publicar").hidden = false;
    document.body.classList.add("sin-scroll");
  } else {
    $("#modal-auth").hidden = false;
    document.body.classList.add("sin-scroll");
  }
});

const btnMisPublicar = $("#btn-mis-publicar");
if (btnMisPublicar) {
  btnMisPublicar.addEventListener("click", () => {
    prepararFormularioPublicacion(null);
    $("#modal-publicar").hidden = false;
    document.body.classList.add("sin-scroll");
  });
}

// ==========================================
// 2. FIREBASE
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
let datosPerfilActual = null;
let unsubscribeMensajes = null;
let unsubscribeEnviados = null;
let propiedadEnBorrador = null;
let elementosGaleriaBorrador = []; 
let elementoArrastradoIdx = null;
let archivoFotoPerfilSeleccionado = null;

// ==========================================
// 3. ESCUCHA FIRESTORE DE INMUEBLES
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
    filtrarYEjeCatalogo();
    renderizarMisPropiedades();
  },
  (err) => {
    console.error("Fallo al sincronizar Firestore:", err);
  }
);

// ==========================================
// 4. CLOUDINARY
// ==========================================
function obtenerStringUrl(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  if (typeof item === "object" && item.url) return item.url;
  return "";
}

function esUrlDeVideo(item) {
  const url = obtenerStringUrl(item);
  if (!url) return false;
  const u = url.toLowerCase().split("?")[0];
  return (
    u.endsWith(".mp4") ||
    u.endsWith(".webm") ||
    u.endsWith(".mov") ||
    url.includes("/video/upload/") ||
    url.startsWith("data:video/") ||
    (typeof item === "object" && item.tipo === "video")
  );
}

async function subirACloudinary(file) {
  const esVideo = file.type.startsWith("video/");
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${esVideo ? "video" : "image"}/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(endpoint, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error ? errorData.error.message : "Error al subir a Cloudinary");
  }

  const data = await res.json();
  return data.secure_url;
}

// ==========================================
// 5. AUTENTICACIÓN Y PERFIL DE COMPRADOR/VENDEDOR
// ==========================================
auth.onAuthStateChanged(async (user) => {
  usuarioActual = user;
  const navMisProp = $("#nav-mis-propiedades");
  const barraMisProp = $("#barra-mis-propiedades");
  const chipPerfilHeader = $("#header-perfil-chip");

  if (user) {
    $("#btn-login-modal").hidden = true;
    $("#btn-logout").hidden = false;
    $("#btn-publicar").hidden = false;
    if (navMisProp) navMisProp.hidden = false;
    if (barraMisProp) barraMisProp.hidden = false;

    await cargarOExigirPerfil(user);
    escucharMensajes(user.uid);
    cerrarCualquierModal();
  } else {
    $("#btn-login-modal").hidden = false;
    $("#btn-logout").hidden = true;
    $("#btn-publicar").hidden = true;
    if (navMisProp) navMisProp.hidden = true;
    if (barraMisProp) barraMisProp.hidden = true;
    if (chipPerfilHeader) chipPerfilHeader.hidden = true;
    datosPerfilActual = null;

    if (unsubscribeMensajes) { unsubscribeMensajes(); unsubscribeMensajes = null; }
    if (unsubscribeEnviados) { unsubscribeEnviados(); unsubscribeEnviados = null; }

    if (window.location.hash === "#mis-propiedades") {
      cambiarVista("inicio");
    }
  }
  filtrarYEjeCatalogo();
  renderizarMisPropiedades();
});

async function cargarOExigirPerfil(user) {
  try {
    const userDoc = await db.collection("usuarios").doc(user.uid).get();
    if (userDoc.exists) {
      datosPerfilActual = userDoc.data();
      actualizarUiPerfil(datosPerfilActual);
    } else {
      abrirModalPerfil(true);
    }
  } catch (err) {
    console.error("Error al obtener perfil:", err);
  }
}

function actualizarUiPerfil(perfil) {
  const avatarUrl = perfil.fotoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200";
  
  const chip = $("#header-perfil-chip");
  if (chip) {
    chip.hidden = false;
    $("#header-avatar").src = avatarUrl;
    $("#header-username").textContent = `@${perfil.username}`;
  }

  if ($("#perfil-avatar")) $("#perfil-avatar").src = avatarUrl;
  if ($("#perfil-nombre")) $("#perfil-nombre").textContent = perfil.nombre;
  if ($("#perfil-handle")) $("#perfil-handle").textContent = `@${perfil.username}`;
}

function abrirModalPerfil(esObligatorio = false) {
  const modal = $("#modal-perfil");
  const form = $("#form-perfil");
  form.reset();
  archivoFotoPerfilSeleccionado = null;

  if (datosPerfilActual) {
    $("#perfil-modal-titulo").textContent = "Editar mi Perfil";
    $("#perfil-input-nombre").value = datosPerfilActual.nombre;
    $("#perfil-input-username").value = datosPerfilActual.username;
    $("#perfil-avatar-img").src = datosPerfilActual.fotoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200";
  } else if (usuarioActual) {
    $("#perfil-modal-titulo").textContent = "Configura tu Perfil";
    $("#perfil-input-nombre").value = usuarioActual.displayName || "";
    $("#perfil-input-username").value = (usuarioActual.email.split("@")[0]).replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
    $("#perfil-avatar-img").src = usuarioActual.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200";
  }

  modal.hidden = false;
  document.body.classList.add("sin-scroll");
}

$("#perfil-input-foto").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    archivoFotoPerfilSeleccionado = file;
    $("#perfil-avatar-img").src = URL.createObjectURL(file);
  }
});

$("#btn-abrir-editar-perfil").addEventListener("click", () => abrirModalPerfil(false));

$("#form-perfil").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!usuarioActual) return;

  const btn = $("#btn-guardar-perfil");
  btn.disabled = true;
  btn.textContent = "Guardando perfil...";

  const nombre = $("#perfil-input-nombre").value.trim();
  const username = $("#perfil-input-username").value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

  try {
    let fotoUrl = datosPerfilActual ? datosPerfilActual.fotoUrl : (usuarioActual.photoURL || "");

    if (archivoFotoPerfilSeleccionado) {
      btn.textContent = "Subiendo foto...";
      fotoUrl = await subirACloudinary(archivoFotoPerfilSeleccionado);
    }

    const payloadPerfil = {
      uid: usuarioActual.uid,
      email: usuarioActual.email,
      nombre: nombre,
      username: username,
      fotoUrl: fotoUrl,
      actualizadoEn: Date.now()
    };

    await db.collection("usuarios").doc(usuarioActual.uid).set(payloadPerfil, { merge: true });
    datosPerfilActual = payloadPerfil;
    actualizarUiPerfil(datosPerfilActual);

    $("#modal-perfil").hidden = true;
    document.body.classList.remove("sin-scroll");
    alert("¡Perfil guardado correctamente!");
  } catch (err) {
    alert("Error al guardar perfil: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Completar Perfil";
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
      $("#auth-error").textContent = "Error: " + err.message;
    });
});

// ==========================================
// 6. GESTIÓN DE MODALES
// ==========================================
function cerrarCualquierModal() {
  document.querySelectorAll(".modal").forEach(m => {
    if (m.id === "modal-perfil" && usuarioActual && !datosPerfilActual) return;
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
// 7. PUBLICACIÓN Y REORDENAMIENTO
// ==========================================
$("#btn-publicar").addEventListener("click", () => {
  prepararFormularioPublicacion(null);
  $("#modal-publicar").hidden = false;
  document.body.classList.add("sin-scroll");
});

function prepararFormularioPublicacion(propiedadAEditar) {
  const form = $("#form-publicar");
  form.reset();
  elementosGaleriaBorrador = [];

  if (propiedadAEditar) {
    $("#pub-modal-titulo").textContent = "Editar Inmueble";
    $("#pub-modal-sub").textContent = "Actualiza los datos y revisa la vista previa.";
    $("#btn-submit-pub").textContent = "Previsualizar Cambios";
    $("#pub-id-editar").value = propiedadAEditar.id;
    $("#pub-fotos").required = false;
    $("#lbl-fotos").textContent = "Reemplazar Fotos / Videos (Opcional)";

    $("#pub-titulo").value = propiedadAEditar.titulo;
    $("#pub-operacion").value = propiedadAEditar.operacion;
    $("#pub-tipo").value = propiedadAEditar.tipo;
    $("#pub-ciudad").value = propiedadAEditar.ciudad;
    $("#pub-sector").value = propiedadAEditar.sector;
    $("#pub-precio").value = propiedadAEditar.precio;
    $("#pub-dorm").value = propiedadAEditar.dormitorios;
    $("#pub-banos").value = propiedadAEditar.banos;
    $("#pub-area").value = propiedadAEditar.area;
    $("#pub-mapa").value = propiedadAEditar.ubicacionUrl || "";
    $("#pub-wa").value = propiedadAEditar.asesorTelefono || "";
    $("#pub-desc").value = propiedadAEditar.descripcion;
    $("#pub-caract").value = (propiedadAEditar.caracteristicas || []).join(", ");
  } else {
    $("#pub-modal-titulo").textContent = "Publicar Inmueble";
    $("#pub-modal-sub").textContent = "Tu anuncio estará disponible para todos los compradores.";
    $("#btn-submit-pub").textContent = "Previsualizar publicación";
    $("#pub-id-editar").value = "";
    $("#pub-fotos").required = true;
    $("#lbl-fotos").textContent = "Fotos y Videos (Archivos multimedia) *";
  }
}

$("#form-publicar").addEventListener("submit", (e) => {
  e.preventDefault();
  e.stopPropagation();

  const idEditar = $("#pub-id-editar").value;
  const inputFotos = $("#pub-fotos");
  const archivosNuevos = Array.from(inputFotos.files);

  elementosGaleriaBorrador = [];

  if (archivosNuevos.length > 0) {
    elementosGaleriaBorrador = archivosNuevos.map(file => ({
      file: file,
      url: URL.createObjectURL(file),
      esVideo: file.type.startsWith("video/")
    }));
  } else if (idEditar) {
    const propExistente = PROPIEDADES.find(p => String(p.id) === String(idEditar));
    if (propExistente && propExistente.galeria) {
      elementosGaleriaBorrador = propExistente.galeria.map(url => ({
        file: null,
        url: obtenerStringUrl(url),
        esVideo: esUrlDeVideo(url)
      }));
    }
  }

  if (elementosGaleriaBorrador.length === 0) {
    alert("Por favor selecciona al menos una fotografía o video.");
    return;
  }

  const autorNombre = datosPerfilActual ? datosPerfilActual.nombre : (usuarioActual ? usuarioActual.displayName : "Propietario");
  const autorUsername = datosPerfilActual ? datosPerfilActual.username : "usuario";
  const autorFoto = datosPerfilActual ? datosPerfilActual.fotoUrl : (usuarioActual ? usuarioActual.photoURL : "");

  propiedadEnBorrador = {
    id: idEditar || null,
    creadorUid: usuarioActual ? usuarioActual.uid : null,
    autorNombre: autorNombre,
    autorUsername: autorUsername,
    autorFoto: autorFoto,
    titulo: $("#pub-titulo").value.trim(),
    operacion: $("#pub-operacion").value,
    tipo: $("#pub-tipo").value,
    ciudad: $("#pub-ciudad").value.trim(),
    sector: $("#pub-sector").value.trim(),
    precio: Number($("#pub-precio").value),
    dormitorios: Number($("#pub-dorm").value) || 0,
    banos: Number($("#pub-banos").value) || 0,
    area: Number($("#pub-area").value) || 0,
    ubicacionUrl: $("#pub-mapa").value.trim(),
    descripcion: $("#pub-desc").value.trim(),
    caracteristicas: $("#pub-caract").value ? $("#pub-caract").value.split(",").map(c => c.trim()).filter(Boolean) : [],
    estado: "disponible",
    asesorTelefono: $("#pub-wa").value.replace(/\D/g, ''),
    destacada: true,
    creadoEn: Date.now(),
    esEdicion: Boolean(idEditar)
  };

  mostrarModalPreview();
});

function mostrarModalPreview() {
  const p = propiedadEnBorrador;
  const urlsActuales = elementosGaleriaBorrador.map(item => item.url);

  const contenedorReordenar = $("#reordenador-fotos");
  if (contenedorReordenar) {
    contenedorReordenar.innerHTML = elementosGaleriaBorrador.map((item, idx) => `
      <div class="reordenador-item" draggable="true" data-index="${idx}">
        <span class="reordenador-badge">${idx === 0 ? "Portada" : idx + 1}</span>
        ${item.esVideo ? `<video src="${item.url}" muted playsinline></video>` : `<img src="${item.url}" alt="Foto ${idx + 1}">`}
      </div>
    `).join("");

    activarDragAndDrop();
  }

  $("#preview-contenido").innerHTML = `
    <div class="modal__imagen-wrap">
      ${generarHtmlCarrusel(urlsActuales, `carrusel-preview`, true)}
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

function activarDragAndDrop() {
  const items = document.querySelectorAll(".reordenador-item");
  items.forEach(item => {
    item.addEventListener("dragstart", (e) => {
      elementoArrastradoIdx = Number(item.dataset.index);
      item.classList.add("arrastrando");
      e.dataTransfer.effectAllowed = "move";
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("arrastrando");
      document.querySelectorAll(".reordenador-item").forEach(el => el.classList.remove("sobre"));
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    item.addEventListener("dragenter", () => item.classList.add("sobre"));
    item.addEventListener("dragleave", () => item.classList.remove("sobre"));

    item.addEventListener("drop", (e) => {
      e.preventDefault();
      const dropIdx = Number(item.dataset.index);
      if (elementoArrastradoIdx !== null && elementoArrastradoIdx !== dropIdx) {
        intercambiarGaleria(elementoArrastradoIdx, dropIdx);
      }
    });

    item.addEventListener("touchstart", () => {
      elementoArrastradoIdx = Number(item.dataset.index);
      item.classList.add("arrastrando");
    }, { passive: true });

    item.addEventListener("touchend", (e) => {
      item.classList.remove("arrastrando");
      const touch = e.changedTouches[0];
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropTarget = targetEl ? targetEl.closest(".reordenador-item") : null;
      if (dropTarget) {
        const dropIdx = Number(dropTarget.dataset.index);
        if (elementoArrastradoIdx !== null && elementoArrastradoIdx !== dropIdx) {
          intercambiarGaleria(elementoArrastradoIdx, dropIdx);
        }
      }
      elementoArrastradoIdx = null;
    });
  });
}

function intercambiarGaleria(origenIdx, destinoIdx) {
  const movido = elementosGaleriaBorrador.splice(origenIdx, 1)[0];
  elementosGaleriaBorrador.splice(destinoIdx, 0, movido);
  mostrarModalPreview();
}

$("#btn-preview-volver").addEventListener("click", (e) => {
  e.preventDefault();
  $("#modal-preview").hidden = true;
  $("#modal-publicar").hidden = false;
});

$("#btn-preview-confirmar").addEventListener("click", async (e) => {
  e.preventDefault();
  if (!propiedadEnBorrador || elementosGaleriaBorrador.length === 0) return;

  const btnConfirmar = $("#btn-preview-confirmar");
  btnConfirmar.disabled = true;
  btnConfirmar.textContent = "Subiendo archivos a la nube...";

  const p = { ...propiedadEnBorrador };
  const esEdicion = p.esEdicion;
  const idDoc = p.id;
  delete p.esEdicion;
  delete p.id;

  try {
    let urlsFinales = [];

    for (let i = 0; i < elementosGaleriaBorrador.length; i++) {
      const item = elementosGaleriaBorrador[i];
      if (item.file) {
        btnConfirmar.textContent = `Subiendo archivo ${i + 1} de ${elementosGaleriaBorrador.length}...`;
        const urlSubida = await subirACloudinary(item.file);
        urlsFinales.push(urlSubida);
      } else {
        urlsFinales.push(item.url);
      }
    }

    p.galeria = urlsFinales;
    btnConfirmar.textContent = "Guardando en la base de datos...";

    if (esEdicion && idDoc) {
      await db.collection("propiedades").doc(String(idDoc)).set(p, { merge: true });
    } else {
      await db.collection("propiedades").add(p);
    }

    cerrarCualquierModal();
    propiedadEnBorrador = null;
    elementosGaleriaBorrador = [];
    $("#form-publicar").reset();
    alert("¡Publicación guardada con éxito!");

    cambiarVista("mis-propiedades");
  } catch (err) {
    alert("Error al publicar: " + err.message);
  } finally {
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = "Confirmar y Publicar";
  }
});

// ==========================================
// 8. CHAT Y CONSULTAS DIRECTAS (COMPRADOR / VENDEDOR)
// ==========================================
function abrirModalChat(destinatarioUid, inmuebleId, inmuebleTitulo) {
  if (!usuarioActual) {
    alert("Inicia sesión con tu cuenta de Google para enviar un mensaje directo al vendedor.");
    $("#modal-auth").hidden = false;
    document.body.classList.add("sin-scroll");
    return;
  }

  if (usuarioActual.uid === destinatarioUid) {
    alert("Eres el propietario de esta publicación; no puedes enviarte un mensaje a ti mismo.");
    return;
  }

  $("#chat-destinatario-uid").value = destinatarioUid || "";
  $("#chat-inmueble-id").value = inmuebleId || "";
  $("#chat-inmueble-titulo").textContent = `Inmueble: "${inmuebleTitulo || 'Publicación'}"`;
  $("#chat-mensaje").value = "";

  $("#modal-chat").hidden = false;
  document.body.classList.add("sin-scroll");
}

$("#form-chat").addEventListener("submit", async (e) => {
  e.preventDefault();
  const destinatarioUid = $("#chat-destinatario-uid").value;
  const inmuebleId = $("#chat-inmueble-id").value;
  const texto = $("#chat-mensaje").value.trim();

  if (!texto) return;

  const btn = $("#btn-enviar-chat");
  btn.disabled = true;
  btn.textContent = "Enviando...";

  const remitenteNombre = datosPerfilActual ? datosPerfilActual.nombre : (usuarioActual.displayName || "Comprador");
  const remitenteUsername = datosPerfilActual ? datosPerfilActual.username : "usuario";
  const remitenteFoto = datosPerfilActual ? datosPerfilActual.fotoUrl : (usuarioActual.photoURL || "");

  try {
    const nuevoMensaje = {
      inmuebleId: inmuebleId,
      inmuebleTitulo: $("#chat-inmueble-titulo").textContent.replace('Inmueble: ', '').replace(/"/g, ''),
      remitenteUid: usuarioActual.uid,
      remitenteNombre: remitenteNombre,
      remitenteUsername: remitenteUsername,
      remitenteFoto: remitenteFoto,
      destinatarioUid: destinatarioUid,
      mensaje: texto,
      creadoEn: Date.now(),
      leido: false,
      respuestas: []
    };

    await db.collection("usuarios").doc(destinatarioUid).collection("mensajes").add(nuevoMensaje);
    await db.collection("usuarios").doc(usuarioActual.uid).collection("mensajes_enviados").add(nuevoMensaje);

    $("#modal-chat").hidden = true;
    document.body.classList.remove("sin-scroll");
    alert("¡Mensaje enviado exitosamente al vendedor! Podrás revisar las respuestas en tu panel.");
  } catch (err) {
    alert("Error al enviar mensaje: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar Mensaje";
  }
});

function escucharMensajes(uid) {
  if (unsubscribeMensajes) unsubscribeMensajes();
  if (unsubscribeEnviados) unsubscribeEnviados();

  // 1. Mensajes que este usuario RECIBE
  unsubscribeMensajes = db.collection("usuarios").doc(uid).collection("mensajes")
    .onSnapshot((snapshot) => {
      const listaRecibidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      listaRecibidos.sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));

      const noLeidos = listaRecibidos.filter(m => !m.leido).length;
      const navBadge = $("#contador-nav-mensajes");
      if (navBadge) {
        navBadge.textContent = noLeidos;
        navBadge.hidden = noLeidos === 0;
      }

      if ($("#cuenta-mis-mensajes")) {
        $("#cuenta-mis-mensajes").textContent = listaRecibidos.length;
      }

      renderizarBandejaRecibidos(listaRecibidos);
    });

  // 2. Consultas que este usuario ENVIÓ como comprador
  unsubscribeEnviados = db.collection("usuarios").doc(uid).collection("mensajes_enviados")
    .onSnapshot((snapshot) => {
      const listaEnviados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      listaEnviados.sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));

      if ($("#cuenta-mensajes-enviados")) {
        $("#cuenta-mensajes-enviados").textContent = listaEnviados.length;
      }

      renderizarBandejaEnviados(listaEnviados);
    });
}

function renderizarBandejaRecibidos(mensajes) {
  const contenedor = $("#lista-mensajes-recibidos");
  if (!contenedor) return;

  if (mensajes.length === 0) {
    contenedor.innerHTML = `<p style="text-align: center; color: var(--c-texto-suave); padding: 3rem 0;">No tienes consultas recibidas sobre tus inmuebles.</p>`;
    return;
  }

  contenedor.innerHTML = mensajes.map(m => {
    const avatar = m.remitenteFoto || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200";
    const fecha = new Date(m.creadoEn).toLocaleDateString("es-EC", { hour: "2-digit", minute: "2-digit" });

    return `
      <article class="mensaje-card">
        <div class="mensaje-card__header">
          <div class="mensaje-card__remitente">
            <img src="${avatar}" class="mensaje-card__avatar" alt="Avatar">
            <div>
              <strong>${m.remitenteNombre}</strong> <small style="color: var(--c-texto-suave);">(@${m.remitenteUsername})</small>
            </div>
          </div>
          <span class="mensaje-card__tiempo">${fecha}</span>
        </div>

        <div class="mensaje-card__inmueble">Inmueble consultado: ${m.inmuebleTitulo}</div>
        <div class="mensaje-card__cuerpo">${m.mensaje}</div>

        ${m.respuestas && m.respuestas.length > 0 ? `
          <div class="mensaje-card__respuestas">
            ${m.respuestas.map(r => `
              <div class="respuesta-item">
                <strong>Tú:</strong> ${r.texto} <small style="float: right; color: var(--c-texto-suave);">${new Date(r.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <form class="mensaje-card__responder" data-form-responder="${m.id}" data-remitente-uid="${m.remitenteUid}">
          <input type="text" placeholder="Escribe tu respuesta al interesado..." required style="height: 40px !important;">
          <button type="submit" class="btn btn--primario btn--sm">Responder</button>
        </form>
      </article>
    `;
  }).join("");
}

function renderizarBandejaEnviados(mensajes) {
  const contenedor = $("#lista-mensajes-enviados");
  if (!contenedor) return;

  if (mensajes.length === 0) {
    contenedor.innerHTML = `<p style="text-align: center; color: var(--c-texto-suave); padding: 3rem 0;">No has enviado consultas a ningún vendedor todavía.</p>`;
    return;
  }

  contenedor.innerHTML = mensajes.map(m => {
    const fecha = new Date(m.creadoEn).toLocaleDateString("es-EC", { hour: "2-digit", minute: "2-digit" });

    return `
      <article class="mensaje-card">
        <div class="mensaje-card__header">
          <strong>Consulta sobre: ${m.inmuebleTitulo}</strong>
          <span class="mensaje-card__tiempo">${fecha}</span>
        </div>

        <div class="mensaje-card__cuerpo"><strong>Tu pregunta:</strong> ${m.mensaje}</div>

        ${m.respuestas && m.respuestas.length > 0 ? `
          <div class="mensaje-card__respuestas">
            ${m.respuestas.map(r => `
              <div class="respuesta-item">
                <strong>Respuesta del Propietario:</strong> ${r.texto}
              </div>
            `).join('')}
          </div>
        ` : `<p style="font-size: .84rem; color: var(--c-texto-suave); margin: .4rem 0 0;">Esperando respuesta del propietario...</p>`}
      </article>
    `;
  }).join("");
}

// Responder mensaje
const listaMensajesRecibidos = $("#lista-mensajes-recibidos");
if (listaMensajesRecibidos) {
  listaMensajesRecibidos.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target.closest("[data-form-responder]");
    if (!form || !usuarioActual) return;

    const msgId = form.dataset.formResponder;
    const input = form.querySelector("input");
    const texto = input.value.trim();
    if (!texto) return;

    try {
      const docRef = db.collection("usuarios").doc(usuarioActual.uid).collection("mensajes").doc(msgId);
      await docRef.update({
        respuestas: firebase.firestore.FieldValue.arrayUnion({
          texto: texto,
          fecha: Date.now()
        }),
        leido: true
      });
      input.value = "";
    } catch (err) {
      alert("Error al responder: " + err.message);
    }
  });
}

// Pestañas de Gestión
$("#tab-btn-inmuebles").addEventListener("click", () => {
  activarPestana("inmuebles");
});

$("#tab-btn-recibidos").addEventListener("click", () => {
  activarPestana("recibidos");
});

$("#tab-btn-enviados").addEventListener("click", () => {
  activarPestana("enviados");
});

function activarPestana(tipo) {
  $("#tab-btn-inmuebles").classList.toggle("activo", tipo === "inmuebles");
  $("#tab-btn-recibidos").classList.toggle("activo", tipo === "recibidos");
  $("#tab-btn-enviados").classList.toggle("activo", tipo === "enviados");

  $("#seccion-mis-inmuebles").classList.toggle("activo", tipo === "inmuebles");
  $("#seccion-mis-recibidos").classList.toggle("activo", tipo === "recibidos");
  $("#seccion-mis-enviados").classList.toggle("activo", tipo === "enviados");
}

// ==========================================
// 9. GESTIÓN: ESTADO Y ELIMINACIÓN
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
// 10. RENDERIZADO DE MIS PROPIEDADES
// ==========================================
function renderizarMisPropiedades() {
  const grilla = $("#grilla-mis-propiedades");
  if (!grilla) return;

  if (!usuarioActual) {
    grilla.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem;">
        <p style="color: var(--c-texto-suave); font-size: 1.1rem; margin-bottom: 1.2rem;">Inicia sesión para gestionar tus publicaciones o responder tus mensajes.</p>
        <button class="btn btn--primario" onclick="$('#modal-auth').hidden = false;">Ingresar con Google</button>
      </div>
    `;
    return;
  }

  const misCasas = PROPIEDADES.filter(p => p.creadorUid && p.creadorUid === usuarioActual.uid);

  if ($("#cuenta-mis-inmuebles")) $("#cuenta-mis-inmuebles").textContent = misCasas.length;
  if ($("#perfil-tipo-cuenta")) {
    $("#perfil-tipo-cuenta").textContent = misCasas.length > 0 ? `${misCasas.length} Inmuebles publicados` : "Comprador / Buscador Activo";
  }

  if (misCasas.length === 0) {
    grilla.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem;">
        <p style="color: var(--c-texto-suave); font-size: 1.1rem; margin-bottom: 1.2rem;">Tu perfil está activo como comprador. Si eres propietario o agente, puedes publicar tu inmueble ahora mismo.</p>
        <button class="btn btn--primario" id="btn-publicar-primera">+ Empezar a publicar inmuebles</button>
      </div>
    `;
    const btnPrimer = $("#btn-publicar-primera");
    if (btnPrimer) {
      btnPrimer.addEventListener("click", () => {
        prepararFormularioPublicacion(null);
        $("#modal-publicar").hidden = false;
        document.body.classList.add("sin-scroll");
      });
    }
    return;
  }

  grilla.innerHTML = misCasas.map(p => {
    const estaVendidoOAlquilado = p.estado === "vendido" || p.estado === "alquilado";

    return `
      <article class="tarjeta ${estaVendidoOAlquilado ? 'tarjeta--cerrada' : ''}" data-id="${p.id}">
        <div class="tarjeta__portada">
          ${generarHtmlCarrusel(p.galeria, `carrusel-mis-${p.id}`)}
          
          <div class="tarjeta__chips-superiores">
            <span class="chip chip--operacion">${p.operacion === "venta" ? "En Venta" : "En Alquiler"}</span>
            ${p.estado === "vendido" ? '<span class="chip chip--estado chip--vendido">VENDIDO</span>' : ''}
            ${p.estado === "alquilado" ? '<span class="chip chip--estado chip--alquilado">ALQUILADO</span>' : ''}
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
          </ul>
        </div>

        <div class="tarjeta__acciones-propietario">
          <button type="button" class="btn btn--secundario btn--sm" data-accion-editar="${p.id}">✎ Editar</button>
          <button type="button" class="btn btn--secundario btn--sm" data-accion-estado="${p.id}">
            ${p.estado === 'disponible' ? `Marcar ${p.operacion === 'venta' ? 'Vendido' : 'Alquilado'}` : 'Reactivar'}
          </button>
          <button type="button" class="btn btn--peligro btn--sm" style="grid-column: 1/-1;" data-accion-eliminar="${p.id}">🗑 Eliminar Publicación</button>
        </div>
      </article>
    `;
  }).join("");
}

const grillaMisPropiedades = $("#grilla-mis-propiedades");
if (grillaMisPropiedades) {
  grillaMisPropiedades.addEventListener("click", (e) => {
    const btnEditar = e.target.closest("[data-accion-editar]");
    if (btnEditar) {
      e.stopPropagation();
      const id = btnEditar.dataset.accionEditar;
      const p = PROPIEDADES.find(x => String(x.id) === String(id));
      if (p) {
        prepararFormularioPublicacion(p);
        $("#modal-publicar").hidden = false;
        document.body.classList.add("sin-scroll");
      }
      return;
    }

    const btnEstado = e.target.closest("[data-accion-estado]");
    if (btnEstado) {
      e.stopPropagation();
      const id = btnEstado.dataset.accionEstado;
      const p = PROPIEDADES.find(x => String(x.id) === String(id));
      if (p) {
        const nuevoEstado = p.estado === "disponible" ? (p.operacion === "venta" ? "vendido" : "alquilado") : "disponible";
        cambiarEstadoPropiedad(String(p.id), nuevoEstado);
      }
      return;
    }

    const btnEliminar = e.target.closest("[data-accion-eliminar]");
    if (btnEliminar) {
      e.stopPropagation();
      const id = btnEliminar.dataset.accionEliminar;
      eliminarPropiedad(String(id));
      return;
    }
  });
}

// ==========================================
// 11. CARRUSEL
// ==========================================
function generarHtmlCarrusel(galeria, idContenedor, esModal = false) {
  if (!galeria || galeria.length === 0) {
    return `<div class="carrusel-slide activo"><img src="https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800" alt="Sin imagen"></div>`;
  }

  const slides = galeria.map((item, index) => {
    const esPrimerSlide = index === 0 ? "activo" : "";
    const urlLimpia = obtenerStringUrl(item);
    const esVideo = esUrlDeVideo(item);

    if (esVideo) {
      return `
        <div class="carrusel-slide ${esPrimerSlide}" data-slide="${index}">
          <video class="carrusel-media" ${esModal ? 'controls playsinline' : 'muted loop autoplay playsinline'}>
            <source src="${urlLimpia}">
            Tu dispositivo no soporta este video.
          </video>
          ${!esModal ? '<span class="badge-multimedia">▶ Video</span>' : ''}
        </div>
      `;
    }

    return `
      <div class="carrusel-slide ${esPrimerSlide}" data-slide="${index}">
        <img src="${urlLimpia}" class="carrusel-media" alt="Propiedad">
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

  const videoActual = slides[indiceActual].querySelector("video");
  if (videoActual) videoActual.pause();

  slides[indiceActual].classList.remove("activo");

  let nuevoIndice = indiceActual + direccion;
  if (nuevoIndice >= slides.length) nuevoIndice = 0;
  if (nuevoIndice < 0) nuevoIndice = slides.length - 1;

  slides[nuevoIndice].classList.add("activo");

  const videoNuevo = slides[nuevoIndice].querySelector("video");
  if (videoNuevo && !videoNuevo.hasAttribute("controls")) {
    videoNuevo.play().catch(() => {});
  }

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
// 12. RENDERIZADO DEL CATÁLOGO GENERAL
// ==========================================
function renderizarCatalogo(lista) {
  const grilla = $("#grilla-propiedades");
  if (!grilla) return;

  if (!lista || lista.length === 0) {
    grilla.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--c-texto-suave); padding: 3rem 0;">No se encontraron inmuebles con los filtros seleccionados.</p>`;
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
          </ul>

          ${!esPropietario && !estaVendidoOAlquilado ? `
            <div class="tarjeta__contacto-fila">
              <button type="button" class="btn btn--chat btn--sm btn--full" data-chat-uid="${p.creadorUid || ''}" data-chat-inmueble="${p.id}" data-chat-titulo="${p.titulo}">
                💬 Chat Directo
              </button>
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }).join("");
}

// Clics en catálogo general
$("#grilla-propiedades").addEventListener("click", (e) => {
  // 1. Prioridad absoluta al botón de Chat Directo
  const btnChat = e.target.closest("[data-chat-uid]");
  if (btnChat) {
    e.preventDefault();
    e.stopPropagation();
    const targetUid = btnChat.dataset.chatUid;
    const inmuebleId = btnChat.dataset.chatInmueble;
    const titulo = btnChat.dataset.chatTitulo;
    abrirModalChat(targetUid, inmuebleId, titulo);
    return;
  }

  // 2. Si es carrusel o elemento con stopPropagation, salir
  if (e.target.closest(".carrusel-btn") || e.target.closest('[data-stop-propagation="true"]')) {
    return;
  }

  // 3. Gestionar/editar
  const btnEditar = e.target.closest("[data-editar]");
  if (btnEditar) {
    e.stopPropagation();
    const id = btnEditar.dataset.editar;
    const p = PROPIEDADES.find(x => String(x.id) === String(id));
    if (p) abrirModalDetalle(p);
    return;
  }

  // 4. Abrir detalle
  const tarjeta = e.target.closest(".tarjeta");
  if (!tarjeta) return;
  const p = PROPIEDADES.find(x => String(x.id) === String(tarjeta.dataset.id));
  if (!p) return;

  abrirModalDetalle(p);
});

function abrirModalDetalle(p) {
  const esPropietario = Boolean(usuarioActual && p.creadorUid && usuarioActual.uid === p.creadorUid);
  const estaCerrado = p.estado === "vendido" || p.estado === "alquilado";
  const telefonoContacto = p.asesorTelefono || "";
  const mensajeWA = encodeURIComponent(`Hola, vi en Los Andes su anuncio "${p.titulo}" por ${money(p.precio)}. ¿Sigue disponible?`);
  const precioM2 = p.area > 0 ? money(Math.round(p.precio / p.area)) : null;

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
        <div class="modal__tags-principales">
          <span class="badge-tipo">${ETIQUETA_TIPO[p.tipo] || p.tipo}</span>
          <span class="chip chip--operacion" style="position:static; display:inline-block;">${p.operacion === "venta" ? "Venta" : "Alquiler"}</span>
          ${p.destacada && !estaCerrado ? '<span class="chip chip--destacada" style="position:static; display:inline-block;">⭐ Destacada</span>' : ''}
        </div>

        <h2 class="modal__titulo">${p.titulo}</h2>
        
        <p class="modal__ubicacion">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          <strong>${p.sector}</strong>, ${p.ciudad}, Ecuador
        </p>

        <div class="modal__precio-box">
          <p class="modal__precio">${money(p.precio)}</p>
          ${precioM2 ? `<span class="modal__precio-m2">(${precioM2} / m²)</span>` : ''}
        </div>
      </div>

      <div class="modal__metricas-grid">
        <div class="metrica-item">
          <span class="metrica-item__icono">🛏️</span>
          <div><strong>${p.dormitorios || 0}</strong><small>Dormitorios</small></div>
        </div>
        <div class="metrica-item">
          <span class="metrica-item__icono">🚿</span>
          <div><strong>${p.banos || 0}</strong><small>Baños</small></div>
        </div>
        <div class="metrica-item">
          <span class="metrica-item__icono">📐</span>
          <div><strong>${p.area || 0} m²</strong><small>Área Total</small></div>
        </div>
      </div>

      <div class="modal__bloque">
        <h3 class="bloque-subtitulo">Detalles y Descripción</h3>
        <p class="bloque-texto">${p.descripcion}</p>
      </div>

      <div class="modal__acciones-contacto">
        ${p.ubicacionUrl ? `
          <a class="btn btn--secundario btn--full" href="${p.ubicacionUrl}" target="_blank" rel="noopener">
            📍 Abrir Ubicación en Google Maps
          </a>
        ` : ''}
        
        ${!estaCerrado && !esPropietario ? `
          <button type="button" class="btn btn--chat btn--full" id="btn-modal-chat">
            💬 Iniciar Chat Directo con el Propietario
          </button>
        ` : ''}

        ${!estaCerrado ? `
          <a class="btn btn--wa btn--full" href="https://wa.me/${telefonoContacto}?text=${mensajeWA}" target="_blank" rel="noopener">
            Contactar por WhatsApp
          </a>
        ` : `
          <div class="aviso-cerrado">Esta propiedad ya se encuentra ${p.estado}.</div>
        `}
      </div>
    </div>
  `;

  if (!esPropietario && !estaCerrado) {
    const btnChatModal = $("#btn-modal-chat");
    if (btnChatModal) {
      btnChatModal.addEventListener("click", () => {
        $("#modal").hidden = true;
        abrirModalChat(p.creadorUid, p.id, p.titulo);
      });
    }
  }

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
// 13. SIMULADOR HIPOTECARIO
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
// 14. FILTROS Y TEMA
// ==========================================
function filtrarYEjeCatalogo() {
  const ciudadFiltro = $("#f-ciudad") ? $("#f-ciudad").value.toLowerCase().trim() : "";
  const sectorFiltro = $("#f-sector") ? $("#f-sector").value.toLowerCase().trim() : "";
  const operacion = $("#f-operacion") ? $("#f-operacion").value : "";
  const tipo = $("#f-tipo") ? $("#f-tipo").value : "";
  const texto = $("#f-texto") ? $("#f-texto").value.toLowerCase().trim() : "";
  const maxPrecio = $("#f-precio") ? Number($("#f-precio").value) : 400000;

  const filtrados = PROPIEDADES.filter(p => {
    const coincideCiudad = !ciudadFiltro || (p.ciudad && p.ciudad.toLowerCase().includes(ciudadFiltro));
    const coincideSector = !sectorFiltro || (p.sector && p.sector.toLowerCase().includes(sectorFiltro));
    const coincideOp = !operacion || p.operacion === operacion;
    const coincideTipo = !tipo || p.tipo === tipo;
    const coincidePrecio = p.precio <= maxPrecio;
    const coincideTexto = !texto || 
      (p.titulo && p.titulo.toLowerCase().includes(texto)) ||
      (p.sector && p.sector.toLowerCase().includes(texto)) ||
      (p.ciudad && p.ciudad.toLowerCase().includes(texto)) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(texto)) ||
      (p.caracteristicas && p.caracteristicas.some(c => c.toLowerCase().includes(texto)));

    return coincideCiudad && coincideSector && coincideOp && coincideTipo && coincidePrecio && coincideTexto;
  });

  renderizarCatalogo(filtrados);
}

$("#f-precio").addEventListener("input", (e) => {
  $("#salida-precio").value = money(Number(e.target.value));
});

$("#form-busqueda").addEventListener("submit", (e) => {
  e.preventDefault();
  filtrarYEjeCatalogo();
});

$("#f-ciudad").addEventListener("change", filtrarYEjeCatalogo);
$("#f-operacion").addEventListener("change", filtrarYEjeCatalogo);
$("#f-tipo").addEventListener("change", filtrarYEjeCatalogo);

$("#btn-tema").addEventListener("click", () => {
  const actual = document.documentElement.getAttribute("data-theme");
  document.documentElement.setAttribute("data-theme", actual === "dark" ? "light" : "dark");
});

// Inicio
const rutaInicial = window.location.hash.replace("#", "") || "inicio";
cambiarVista(rutaInicial);
calcularSimulador();