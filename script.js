/* =========================================================
   Andina Propiedades — Lógica con Firebase y EmailJS
   ========================================================= */

// DATOS INICIALES (Mismos de tu catálogo)
const PROPIEDADES = [
  {
    id: 1, titulo: "Casa familiar con jardín y estudio", operacion: "venta", tipo: "casa",
    ciudad: "Riobamba", sector: "La Primavera", precio: 129000, dormitorios: 4, banos: 3, area: 210,
    parqueaderos: 2, anio: 2019, destacada: true, color: "#2f6f63",
    descripcion: "Casa de dos plantas en conjunto cerrado con guardianía 24/7.",
    caracteristicas: ["Conjunto cerrado", "Guardianía 24/7", "Área de asados"],
    asesor: { nombre: "Andina Propiedades", telefono: "593990000001" },
    galeria: ["img/propiedad-1-12.jpeg"]
  }
];

const $ = (sel) => document.querySelector(sel);
const money = (n) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const ETIQUETA_TIPO = { casa: "Casa", departamento: "Departamento", terreno: "Terreno", local: "Local comercial" };

// ==========================================
// 1. CONFIGURACIÓN FIREBASE Y EMAILJS
// ==========================================
// ==========================================
// 1. CONFIGURACIÓN FIREBASE Y EMAILJS
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
// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ==========================================
// 2. LÓGICA DE AUTENTICACIÓN
// ==========================================
let isLoginMode = true;

// Escuchar estado de sesión
auth.onAuthStateChanged(user => {
  if (user) {
    $("#btn-login-modal").hidden = true;
    $("#btn-logout").hidden = false;
    $("#btn-publicar").hidden = false;
    cerrarModalAuth();
  } else {
    $("#btn-login-modal").hidden = false;
    $("#btn-logout").hidden = true;
    $("#btn-publicar").hidden = true;
  }
});

$("#btn-logout").addEventListener("click", () => auth.signOut());
$("#btn-login-modal").addEventListener("click", () => { $("#modal-auth").hidden = false; });
$("[data-cerrar-auth]").addEventListener("click", cerrarModalAuth);

function cerrarModalAuth() {
  $("#modal-auth").hidden = true;
  $("#auth-error").textContent = "";
}

// Alternar entre Login y Registro
$("#btn-toggle-auth").addEventListener("click", () => {
  isLoginMode = !isLoginMode;
  $("#btn-auth-submit").textContent = isLoginMode ? "Ingresar" : "Registrarse";
  $("#btn-toggle-auth").textContent = isLoginMode ? "Regístrate" : "Inicia sesión";
});

// Login con Google
$("#btn-google").addEventListener("click", () => {
  auth.signInWithPopup(googleProvider).catch(err => $("#auth-error").textContent = err.message);
});

// Login/Registro con Correo
$("#form-auth").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = $("#auth-email").value;
  const pass = $("#auth-pass").value;

  if (isLoginMode) {
    auth.signInWithEmailAndPassword(email, pass).catch(err => $("#auth-error").textContent = "Error: Verifica tus credenciales.");
  } else {
    auth.createUserWithEmailAndPassword(email, pass).catch(err => $("#auth-error").textContent = err.message);
  }
});

// ==========================================
// 3. LÓGICA DE PUBLICACIÓN Y COMISIÓN
// ==========================================
$("#btn-publicar").addEventListener("click", () => { $("#modal-publicar").hidden = false; });
$("[data-cerrar-pub]").addEventListener("click", () => { $("#modal-publicar").hidden = true; });

// Calcular comisión en tiempo real (1%, 2%, 3%)
$("#pub-precio").addEventListener("input", (e) => {
  const valor = Number(e.target.value) || 0;
  let pct = 1;
  if (valor > 100000) pct = 3;
  else if (valor >= 50000) pct = 2;
  
  const comision = (valor * pct) / 100;
  $("#pub-comision-txt").textContent = `Comisión (${pct}%): ${money(comision)}`;
});

// Enviar Formulario de Publicación
$("#form-publicar").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // 1. Leer Imágenes a Base64
  const archivos = $("#pub-fotos").files;
  const promesasFotos = Array.from(archivos).map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  });
  const galeriaBase64 = await Promise.all(promesasFotos);

  // 2. Crear objeto Propiedad
  const nuevaPropiedad = {
    id: Date.now(),
    titulo: $("#pub-titulo").value,
    operacion: $("#pub-operacion").value,
    tipo: $("#pub-tipo").value,
    ciudad: $("#pub-ciudad").value,
    sector: $("#pub-sector").value,
    precio: Number($("#pub-precio").value),
    dormitorios: Number($("#pub-dorm").value),
    banos: Number($("#pub-banos").value),
    area: Number($("#pub-area").value),
    anio: Number($("#pub-anio").value),
    descripcion: $("#pub-desc").value,
    caracteristicas: $("#pub-caract").value.split(",").map(c => c.trim()),
    asesor: {
      nombre: auth.currentUser.email.split("@")[0], // Nombre basado en correo
      telefono: $("#pub-wa").value.replace(/\D/g,'') // Limpiar número
    },
    galeria: galeriaBase64,
    destacada: false
  };

  // 3. Añadir al array y actualizar UI
  PROPIEDADES.unshift(nuevaPropiedad);
  renderizarCatalogo(PROPIEDADES);
  $("#modal-publicar").hidden = true;
  $("#form-publicar").reset();
  $("#pub-comision-txt").textContent = "Calculando...";

  // 4. Enviar notificación por EmailJS
  // 4. Enviar notificación por EmailJS
  emailjs.init("TU_PUBLIC_KEY_DE_EMAILJS"); // <-- Falta esta clave
  
  // Aquí ya agregué tu Service ID: "service_qxmvxtg"
  emailjs.send("service_qxmvxtg", "TU_TEMPLATE_ID", { // <-- Falta el Template ID
    titulo: nuevaPropiedad.titulo,
    precio: money(nuevaPropiedad.precio),
    usuario: auth.currentUser.email,
    whatsapp: nuevaPropiedad.asesor.telefono
  }).then(() => {
    alert("¡Propiedad publicada con éxito y notificación enviada!");
  }).catch(err => console.log("Error al enviar email", err));

// ==========================================
// 4. LÓGICA DE CATÁLOGO Y MODAL (Mantenido)
// ==========================================
function renderizarCatalogo(lista) {
  const grilla = $("#grilla-propiedades");
  grilla.innerHTML = lista.map(p => `
    <article class="tarjeta" data-id="${p.id}">
      <div class="tarjeta__portada">
        <img class="tarjeta__imagen" src="${p.galeria[0]}" style="width:100%; height:100%; object-fit:cover;">
        <span class="chip">${p.operacion === "venta" ? "En venta" : "En alquiler"}</span>
      </div>
      <div class="tarjeta__cuerpo">
        <p class="tarjeta__precio">${money(p.precio)}</p>
        <h3 class="tarjeta__titulo">${p.titulo}</h3>
        <p class="tarjeta__sector">${ETIQUETA_TIPO[p.tipo]} · ${p.sector}, ${p.ciudad}</p>
      </div>
    </article>
  `).join("");
}

// Abrir Modal de Propiedad y redirigir WhatsApp al usuario creado
$("#grilla-propiedades").addEventListener("click", (e) => {
  const tarjeta = e.target.closest(".tarjeta");
  if (!tarjeta) return;
  const p = PROPIEDADES.find(x => x.id === Number(tarjeta.dataset.id));
  
  const mensajeWA = encodeURIComponent(`Hola, me interesa la propiedad "${p.titulo}" por ${money(p.precio)}. ¿Podemos coordinar una visita?`);

  $("#modal-contenido").innerHTML = `
    <img src="${p.galeria[0]}" style="width:100%; border-radius:8px; margin-bottom:1rem;">
    <h2>${p.titulo}</h2>
    <p class="tarjeta__precio" style="font-size:2rem; color:var(--c-marca); font-weight:bold;">${money(p.precio)}</p>
    <p>${p.descripcion}</p>
    <a class="btn btn--wa" href="https://wa.me/${p.asesor.telefono}?text=${mensajeWA}" target="_blank">Contactar por WhatsApp</a>
  `;
  $("#modal").hidden = false;
});

$("[data-cerrar]").addEventListener("click", () => { $("#modal").hidden = true; });

// Arranque inicial
renderizarCatalogo(PROPIEDADES);})
