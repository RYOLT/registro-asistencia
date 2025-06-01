import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

const infoAlumno = document.getElementById("infoAlumno");
const contenidoAlumno = document.getElementById("contenidoAlumno");
const contProfe = document.getElementById("contProfe");
const listaAsistencias = document.getElementById("listaAsistencias");
const listasProfesor = document.getElementById("listasProfesor");
//const logoutBtn = document.getElementById("logoutBtn");

// Variable global para el usuario actual
let usuarioActual = null;
let qrActual = null;
let dispositivoId = null;


// Horarios de clases por día
const horariosClases = {
  "Lunes": {
    "13:20-15:00": "M3S1",
    "15:00-16:40": "Reacciones Quimicas",
    "17:10-18:00": "Orientacion Educativa",
    "18:00-18:50": "Consciencia Histórica 1",
  },
  "Martes": {
    "14:10-16:40": "M3S2",
    "17:10-18:50": "Temas Selectos de Matematicas 1", 
    "18:50-20:30": "M3S1",
  },
  "Miércoles": {
    "14:10-16:40": "M3S1",
    "17:10-18:50": "Ciencias Sociales 3",
    "18:50-20:30": "Temas Selectos de Matematicas  1",
  },
  "Jueves": {
    "13:20-16:40": "M3S2",
    "17:10-18:50": "Conciencia Historica 1",
    "18:50-19:40": "Tutorias",
    "19:10-20:30": "Ingles",
  },
  "Viernes": {
    "14:10-16:40": "M3S2",
    "17:10-18:50": "Reacciones Quimicas",
    "18:50-20:30": "Ingles",
  }
};

// Generar ID único del dispositivo
function generarDispositivoId() {
  let id = localStorage.getItem('dispositivo_id');
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('dispositivo_id', id);
  }
  return id;
}

// Verificar si el dispositivo ya está registrado con otra cuenta
async function verificarDispositivoUnico(userId) {
  try {
    dispositivoId = generarDispositivoId();
    
    // Buscar si este dispositivo ya está registrado con otra cuenta
    const q = query(collection(db, "dispositivos"), where("dispositivoId", "==", dispositivoId));
    const querySnapshot = await getDocs(q);
    
    let dispositivoRegistrado = false;
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userId !== userId) {
        dispositivoRegistrado = true;
      }
    });
    
    if (dispositivoRegistrado) {
      throw new Error("Este dispositivo ya está registrado con otra cuenta. Solo se permite una cuenta por dispositivo.");
    }
    
    //Registrar o actualizar el dispositivo con el usuario actual
    await setDoc(doc(db, "dispositivos", dispositivoId), {
      dispositivoId: dispositivoId,
      userId: userId,
      ultimoAcceso: serverTimestamp(),
      ip: await obtenerIP()
    });
    
    return true;
  } catch (error) {
    console.error("Error verificando dispositivo:", error);
    throw error;
  }
}

// Obtener IP del usuario
async function obtenerIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error("Error obteniendo IP:", error);
    return "IP_no_disponible";
  }
}

// Función para obtener la clase actual basada en día y hora
function obtenerClaseActual() {
  const ahora = new Date();
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const diaActual = dias[ahora.getDay()];
  const horaActual = ahora.getHours() * 100 + ahora.getMinutes();

  if (!horariosClases[diaActual]) {
    return { dia: diaActual, clase: "Sin clases", horario: "N/A" };
  }

  const horarios = horariosClases[diaActual];
  
  for (const [horario, materia] of Object.entries(horarios)) {
    const [inicio, fin] = horario.split("-");
    const [horaInicio, minInicio] = inicio.split(":").map(Number);
    const [horaFin, minFin] = fin.split(":").map(Number);
    
    const inicioNum = horaInicio * 100 + minInicio;
    const finNum = horaFin * 100 + minFin;
    
    if (horaActual >= inicioNum && horaActual <= finNum) {
      return { dia: diaActual, clase: materia, horario: horario };
    }
  }
  
  return { dia: diaActual, clase: "Fuera de horario", horario: "N/A" };
}


// Cargar QRCode desde CDN
function cargarQRCode() {
  return new Promise((resolve, reject) => {
    if (window.QRCode) {
      resolve();
      return;
    }
    
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      console.log("Usuario autenticado:", user.uid);
      usuarioActual = user;
      
      // Verificar dispositivo único
      await verificarDispositivoUnico(user.uid);
      
      const docRef = doc(db, "alumnos", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("Datos del usuario:", data);
        
        infoAlumno.textContent = `Bienvenido, ${data.nombre}`;

        if (data.rol === "alumno" || data.rol === "alumnos" || !data.rol) {
          contenidoAlumno.style.display = "block";
          cargarAsistenciasAlumno(data.nombre);
          await cargarQRCode();
          mostrarGeneradorQR(data);
        } else if (data.rol === "profesor") {
          contProfe.style.display = "block";
          cargarAsistenciasProfesor();
        }
      } else {
        console.error("Usuario no encontrado en Firestore");
        infoAlumno.textContent = "Usuario no encontrado";
      }
    } catch (error) {
      console.error("Error de autenticación:", error);
      alert(error.message);
      signOut(auth);
    }
  } else {
    window.location.href = "index.html";
  }
});

//logoutBtn.addEventListener("click", () => {
  //signOut(auth).then(() => {
    //window.location.href = "index.html";
  //});
document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            if (typeof signOut !== 'undefined' && typeof auth !== 'undefined') {
                signOut(auth).then(() => {
                    window.location.href = "index.html";
                }).catch((error) => {
                    console.error('Error al cerrar sesión:', error);
                    window.location.href = "index.html";
                });
            } else {
                // Fallback si Firebase no está disponible
                window.location.href = "index.html";
            }
        });
    }
});


async function cargarAsistenciasAlumno(nombreCompleto) {
  try {
    const q = query(collection(db, "asistencias"), where("nombreCompleto", "==", nombreCompleto));
    const querySnapshot = await getDocs(q);

    listaAsistencias.innerHTML = "";
    
    if (querySnapshot.empty) {
      const li = document.createElement("li");
      li.textContent = "No hay asistencias registradas";
      listaAsistencias.appendChild(li);
    } else {
      querySnapshot.forEach((doc) => {
        const asistencia = doc.data();
        const li = document.createElement("li");
        li.textContent = `${asistencia.fecha} - ${asistencia.clase} - ${asistencia.hora}`;
        listaAsistencias.appendChild(li);
      });
    }
  } catch (error) {
    console.error("Error cargando asistencias:", error);
  }
}

async function cargarAsistenciasProfesor() {
  try {
    const q = query(collection(db, "asistencias"));
    const querySnapshot = await getDocs(q);

    listasProfesor.innerHTML = "";
    
    querySnapshot.forEach((doc) => {
      const asistencia = doc.data();
      const li = document.createElement("li");
      li.textContent = `${asistencia.nombreCompleto} - ${asistencia.fecha} - ${asistencia.clase} - ${asistencia.hora}`;
      listasProfesor.appendChild(li);
    });
  } catch (error) {
    console.error("Error cargando asistencias profesor:", error);
  }
}

function mostrarGeneradorQR(userData) {
  const container = document.createElement("div");
  container.style.textAlign = "center";
  container.style.margin = "20px";
  
  const titulo = document.createElement("h3");
  titulo.textContent = "Código QR de Asistencia";
  container.appendChild(titulo);
  
  // Mostrar información de clase actual
  const infoClase = document.createElement("div");
  infoClase.style.margin = "20px";
  infoClase.style.padding = "15px";
  infoClase.style.border = "2px solid #007bff";
  infoClase.style.borderRadius = "10px";
  infoClase.style.backgroundColor = "#f8f9fa";
  
  const claseActual = obtenerClaseActual();
  infoClase.innerHTML = `
    <h4>Clase Actual</h4>
    <p><strong>Día:</strong> ${claseActual.dia}</p>
    <p><strong>Materia:</strong> ${claseActual.clase}</p>
    <p><strong>Horario:</strong> ${claseActual.horario}</p>
  `;
  
  container.appendChild(infoClase);

  // Contenedor del QR
  const qrContainer = document.createElement("div");
  qrContainer.id = "qrContainer";
  qrContainer.style.margin = "20px auto";
  qrContainer.style.maxWidth = "200px";
  
  // Botones
  const botonesContainer = document.createElement("div");
  botonesContainer.style.margin = "20px";
  
  // Botón generar QR
  const generarBtn = document.createElement("button");
  generarBtn.textContent = "Generar Código QR";
  generarBtn.style.padding = "10px 20px";
  generarBtn.style.fontSize = "16px";
  generarBtn.style.backgroundColor = "#007bff";
  generarBtn.style.color = "white";
  generarBtn.style.border = "none";
  generarBtn.style.borderRadius = "5px";
  generarBtn.style.cursor = "pointer";
  generarBtn.style.margin = "5px";
  
  generarBtn.addEventListener("click", () => generarQR(userData, qrContainer, claseActual));
  
  // Botón guardar QR
  const guardarBtn = document.createElement("button");
  guardarBtn.textContent = "Guardar QR";
  guardarBtn.style.padding = "10px 20px";
  guardarBtn.style.fontSize = "16px";
  guardarBtn.style.backgroundColor = "#28a745";
  guardarBtn.style.color = "white";
  guardarBtn.style.border = "none";
  guardarBtn.style.borderRadius = "5px";
  guardarBtn.style.cursor = "pointer";
  guardarBtn.style.margin = "5px";
  
  guardarBtn.addEventListener("click", () => guardarQR());
  
  // Botón Para recargar el QR con nuevo patrón
  const recargarBtn = document.createElement("button");
  //recargarBtn.textContent = " Recargar QR";
  //recargarBtn.style.padding = "10px 20px";
  //recargarBtn.style.fontSize = "16px";
  //recargarBtn.style.backgroundColor = "#ffc107";
  //recargarBtn.style.color = "black";
  //recargarBtn.style.border = "none";
  //recargarBtn.style.borderRadius = "5px";
  //recargarBtn.style.cursor = "pointer";
  //recargarBtn.style.margin = "5px";
  
  recargarBtn.addEventListener("click", () => {
    // Forzar regeneración con nuevo patrón
    const claseActual = obtenerClaseActual();
    generarQR(userData, qrContainer, claseActual);
  });
  
  // Botón leer QR
  const leerBtn = document.createElement("button");
  leerBtn.textContent = "Leer QR";
  leerBtn.style.padding = "10px 20px";
  leerBtn.style.fontSize = "16px";
  leerBtn.style.backgroundColor = "#dc3545";
  leerBtn.style.color = "white";
  leerBtn.style.border = "none";
  recargarBtn.style.borderRadius = "5px";
  leerBtn.style.cursor = "pointer";
  leerBtn.style.margin = "5px";
  
  leerBtn.addEventListener("click", () => leerQR());
  
  botonesContainer.appendChild(generarBtn);
  botonesContainer.appendChild(guardarBtn);
  botonesContainer.appendChild(recargarBtn);
  botonesContainer.appendChild(leerBtn);
  
  container.appendChild(botonesContainer);
  container.appendChild(qrContainer);
  
  contenidoAlumno.appendChild(container);
  
  // // Generar QR automáticamente al cargar
  //generarQR(userData, qrContainer, claseActual);
  
  // Auto-regenerar QR cada 2 minutos para cambiar patrón
  setInterval(() => {
    const claseActualizada = obtenerClaseActual();
    generarQR(userData, qrContainer, claseActualizada);
    console.log("QR auto-regenerado con nuevo patrón");
  }, 120000); // 2 minutos
}

function generarQR(userData, container, claseInfo) {
  try {
    // Generar ID único con timestamp y elemento aleatorio adicional para cambiar patrón
    const timestamp = Date.now();
    const randomSeed = Math.random().toString(36).substring(2, 10);
    const patternChanger = Math.floor(Math.random() * 9999).toString(36);
    const qrId = timestamp.toString(36) + randomSeed + patternChanger;
    
    const ahora = new Date();
    
    // Agregar datos adicionales para cambiar el patrón del QR
    const randomPadding = Math.random().toString(36).substring(2, 6);
    
    // Datos optimizados y comprimidos para el QR con variación de patrón
    const qrData = {
      i: qrId,                    // id único
      n: userData.nombre.substring(0, 20), // nombre (máximo 20 chars)
      u: usuarioActual.uid.substring(0, 10), // uid (primeros 10 chars)
      c: claseInfo.clase.substring(0, 15), // clase (máximo 15 chars)
      h: claseInfo.horario.substring(0, 11), // horario
      t: timestamp,               // timestamp exacto
      d: dispositivoId.substring(-8), // últimos 8 chars del dispositivo
      r: randomPadding,           // padding aleatorio para cambiar patrón
      v: Math.floor(timestamp / 1000) % 100, // versión basada en tiempo
      alumno: userData.nombre, // Nombre completo del alumno
      clase: claseInfo.clase, // Clase actual
    };
    
    // Guardar datos completos para validación
    qrActual = {
      id: qrId,
      nombreCompleto: userData.nombre,
      uid: usuarioActual.uid,
      dia: claseInfo.dia,
      clase: claseInfo.clase,
      horario: claseInfo.horario,
      timestamp: timestamp,
      fecha: ahora.toLocaleDateString(),
      hora: ahora.toLocaleTimeString(),
      dispositivoId: dispositivoId,
      randomPadding: randomPadding,
      version: qrData.v
    };
    
    // Limpiar container con animación
    container.style.opacity = "0";
    setTimeout(() => {
      container.innerHTML = "";
      
      if (window.QRCode) {
        const qrDiv = document.createElement("div");
        container.appendChild(qrDiv);
        
        // Usar nivel de corrección más bajo para permitir más datos
        const qr = new QRCode(qrDiv, {
          text: JSON.stringify(qrData),
          width: 150,
          height: 150,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.L // Cambiar de H a L para más capacidad
        });
        
        console.log("QR generado (comprimido):", qrData);
        console.log("QR completo guardado:", qrActual);
        
        const infoDiv = document.createElement("div");
        infoDiv.style.marginTop = "10px";
        infoDiv.style.fontSize = "12px";
        infoDiv.innerHTML = `
          <p><strong>Válido para:</strong> ${claseInfo.clase}</p>
          <p><strong>Generado:</strong> ${qrActual.hora}</p>
          <p style="color: #dc3545;"><strong>⚠️ Un solo uso</strong></p>
          <p style="color: #6c757d; font-size: 10px;">ID: ${qrId.substring(0, 8)}...</p>
          <p style="color: #28a745; font-size: 10px;">✨ Patrón único v${qrData.v}</p>
        `;
        container.appendChild(infoDiv);
        
        // Restaurar opacidad con animación
        container.style.opacity = "1";
        container.style.transition = "opacity 0.3s ease-in-out";
        
      } else {
        container.innerHTML = "<p style='color: red;'>Error: No se pudo cargar la librería QR</p>";
        container.style.opacity = "1";
      }
    }, 150);
    
  } catch (error) {
    console.error("Error generando QR:", error);
    container.innerHTML = "<p style='color: red;'>Error generando código QR: " + error.message + "</p>";
    container.style.opacity = "1";
  }
}

function guardarQR() {
  if (!qrActual) {
    alert("No hay código QR generado para guardar");
    return;
  }

  const canvas = document.querySelector("#qrContainer canvas");
  if (!canvas) {
    alert("No se encontró el código QR para guardar");
    return;
  }

  // Crear enlace de descarga
  const link = document.createElement("a");
  link.download = `QR_${qrActual.clase}_${qrActual.fecha.replace(/\//g, '-')}.png`;
  link.href = canvas.toDataURL();
  link.click();
  
  console.log("QR guardado:", qrActual);
  alert("Código QR guardado exitosamente");
}


window.addEventListener("load", () => {
  console.log("Página cargada - QR será regenerado automáticamente");
});

// Event listener para regenerar QR al recargar página
window.addEventListener("beforeunload", () => {
  // Invalidar QR actual al cerrar/recargar página
  qrActual = null;
});

// Regenerar QR al hacer focus en la ventana (usuario regresa a la pestaña)
// window.addEventListener("focus", () => {
//   if (usuarioActual && contenidoAlumno.style.display === "block") {
//     const container = document.getElementById("qrContainer");
//     if (container) {
//       // Obtener datos del usuario actual
//       const docRef = doc(db, "alumnos", usuarioActual.uid);
//       getDoc(docRef).then((docSnap) => {
//         if (docSnap.exists()) {
//           const userData = docSnap.data();
//           const claseActual = obtenerClaseActual();
//           generarQR(userData, container, claseActual);
//           console.log("QR regenerado al hacer focus en la ventana");
//         }
//       });
//     }
//   }
// });


const COORDENADAS_ESCUELA = {
  latitud: 20.119646,  // Coordenadas del salon
  longitud:  -98.779359,
  radio: 5 // Radio en metros permitido
};

// Función para calcular distancia entre dos puntos geo en metros
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radio Tierra en metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Verifica si el usuario está dentro del radio permitido
function verificarUbicacion() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("La geolocalización no está soportada por este navegador."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const distancia = calcularDistancia(latitude, longitude,
                                            COORDENADAS_ESCUELA.latitud,
                                            COORDENADAS_ESCUELA.longitud);
        console.log(`Distancia a la escuela: ${distancia.toFixed(2)} metros`);
        if (distancia <= COORDENADAS_ESCUELA.radio) {
          resolve({ valida: true, distancia: distancia.toFixed(2), latitude, longitude });
        } else {
          resolve({ valida: false, distancia: distancia.toFixed(2), latitude, longitude });
        }
      },
      (error) => {
        let mensaje = "";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            mensaje = "Permiso de ubicación denegado";
            break;
          case error.POSITION_UNAVAILABLE:
            mensaje = "Ubicación no disponible";
            break;
          case error.TIMEOUT:
            mensaje = "Tiempo agotado obteniendo ubicación";
            break;
          default:
            mensaje = "Error desconocido obteniendo ubicación";
        }
        reject(new Error(mensaje));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

// Función para leer QR desde una imagen (usa canvas y jsQR)
async function leerQRCodeDesdeImagen(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        // Crear canvas para extraer datos de imagen
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          console.log("QR decodificado:", code.data);
          resolve(code.data);
        } else {
          reject(new Error('No se pudo leer el código QR. Por favor intenta con otra imagen.'));
        }
      };
      image.onerror = () => reject(new Error('Error cargando la imagen del QR.'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}

// Función principal que activa el input para seleccionar imagen y manejar el proceso
async function leerQR() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";

  input.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      // Verificar ubicación antes
      const ubicacion = await verificarUbicacion();
      if (!ubicacion.valida) {
        alert(` No puedes registrar asistencia desde esta ubicación.\nDistancia: ${ubicacion.distancia}m\nMáximo permitido: ${COORDENADAS_ESCUELA.radio}m`);
        return;
      }
      // Leer QR
      const qrDataRaw = await leerQRCodeDesdeImagen(file);
      // Asumiremos que el código QR tiene JSON con campos necesarios, ej: { alumno: "Nombre", clase: "Matemáticas" }
      let qrData;
      try {
        qrData = JSON.parse(qrDataRaw);
      } catch(e) {
        alert("El código QR no contiene datos válidos en formato JSON.");
        return;
      }

      if (!qrData.alumno || !qrData.clase) {
        alert("El código QR no contiene los datos necesarios (alumno y clase).");
        return;
      }

      // Registrar asistencia
      const resultado = await registrarAsistencia(qrData);
      alert(resultado.message);

      if (resultado.success) {
        // Refrescar la tabla de asistencias para que se actualice en la página
        actualizarTablaAsistenciasProfesor();
      }
    } catch (error) {
      console.error(error);
      alert('Error durante el proceso: ' + error.message);
    }
  };
  input.click();
}

async function registrarAsistencia(qrData) {
  try {
    // Validar que qrData contenga los campos necesarios
    if (!qrData.alumno || !qrData.clase) {
      return { success: false, message: "El código QR no contiene información válida de alumno o clase." };
    }

    const nuevaAsistencia = {
      alumno: qrData.alumno, // Usar el nombre del alumno del QR
      clase: qrData.clase,   // Usar la clase del QR
      fecha: new Date().toISOString().split("T")[0],
      estado: 'presente',
      hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date()
    };

    await addDoc(collection(db, "asistencias"), nuevaAsistencia);
    console.log("Asistencia registrada:", nuevaAsistencia);
    return { success: true, message: "Asistencia registrada correctamente." };
  } catch (error) {
    console.error('Error guardando la asistencia:', error);
    return { success: false, message: "Fallo al registrar asistencia: " + error.message };
  }
}


// Función para actualizar la tabla de asistencias en la página de profesores
async function actualizarTablaAsistenciasProfesor() {
  try {
    const listasProfesor = document.getElementById("listasProfesor");
    if (!listasProfesor) return;
    listasProfesor.innerHTML = '';

    const q = query(collection(db, "asistencias"), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(doc => {
      const data = doc.data();
      const li = document.createElement("li");
      li.textContent = `${data.alumno} - ${data.fecha} - ${data.clase} - ${data.hora}`;
      listasProfesor.appendChild(li);
    });

  } catch (error) {
    console.error("Error actualizando la tabla de asistencias:", error);
  }
}

// Exportar funciones principales para uso externo (si usas módulos)
window.leerQR = leerQR;
window.actualizarTablaAsistenciasProfesor = actualizarTablaAsistenciasProfesor;


