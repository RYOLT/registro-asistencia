// Este archivo contiene la lógica de autenticación para el login de alumnos y profesores
// Modificado con debug para identificar problemas de autenticación y detección de roles

import { auth, db } from "./firebase.js";
import {signInWithEmailAndPassword,} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import {
  getDoc,
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");

// Función para obtener la IP del cliente
async function obtenerIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error al obtener IP:', error);
    return generarIdDispositivo();
  }
}

// Función alternativa para generar ID único del dispositivo
function generarIdDispositivo() {
  const navegador = navigator.userAgent;
  const idioma = navigator.language;
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const pantalla = `${screen.width}x${screen.height}`;
  
  const datos = navegador + idioma + zona + pantalla;
  let hash = 0;
  for (let i = 0; i < datos.length; i++) {
    const char = datos.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'device_' + Math.abs(hash).toString(16);
}

// Función para buscar usuario en ambas colecciones
async function buscarUsuario(uid, nombreCompleto) {
  console.log("Buscando usuario en ambas colecciones...");
  
  // Buscar en alumnos primero
  const alumnoRef = doc(db, "alumnos", uid);
  const alumnoSnap = await getDoc(alumnoRef);
  
  if (alumnoSnap.exists()) {
    console.log("✓ Usuario encontrado en colección 'alumnos'");
    return {
      existe: true,
      tipo: 'alumno',
      datos: alumnoSnap.data(),
      docRef: alumnoRef
    };
  }
  
  // Buscar en profesores
  const profesorRef = doc(db, "profesores", uid);
  const profesorSnap = await getDoc(profesorRef);
  
  if (profesorSnap.exists()) {
    console.log("✓ Usuario encontrado en colección 'profesores'");
    return {
      existe: true,
      tipo: 'profesor',
      datos: profesorSnap.data(),
      docRef: profesorRef
    };
  }
  
  console.log("✗ Usuario NO encontrado en ninguna colección");
  return { existe: false };
}

// Función para debug - buscar por nombre en ambas colecciones
async function debugBuscarPorNombre(nombreCompleto) {
  console.log("=== DEBUG: Buscando por nombre ===");
  
  // Buscar en alumnos
  const alumnosRef = collection(db, "alumnos");
  const qAlumnos = query(alumnosRef, where("nombre", "==", nombreCompleto));
  const alumnosSnapshot = await getDocs(qAlumnos);
  
  if (!alumnosSnapshot.empty) {
    console.log("Usuario encontrado en 'alumnos' por nombre:");
    alumnosSnapshot.forEach((doc) => {
      console.log("ID:", doc.id, "Datos:", doc.data());
    });
    return true;
  }
  
  // Buscar en profesores
  const profesoresRef = collection(db, "profesores");
  const qProfesores = query(profesoresRef, where("nombre", "==", nombreCompleto));
  const profesoresSnapshot = await getDocs(qProfesores);
  
  if (!profesoresSnapshot.empty) {
    console.log("Usuario encontrado en 'profesores' por nombre:");
    profesoresSnapshot.forEach((doc) => {
      console.log("ID:", doc.id, "Datos:", doc.data());
    });
    return true;
  }
  
  console.log("No se encontró usuario con nombre:", nombreCompleto, "en ninguna colección");
  return false;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombreCompleto = loginForm["nombre"].value.trim();
  const contrasena = loginForm["password"].value.trim();

  // Generar el email simulado como lo haces actualmente
  const correoSimulado = `${nombreCompleto.replace(/\s+/g, '').toLowerCase()}@cecyteh.edu.mx`;

  console.log("=== DEBUG LOGIN ===");
  console.log("Nombre ingresado:", nombreCompleto);
  console.log("Contraseña ingresada:", contrasena);
  console.log("Email generado:", correoSimulado);

  try {
    // Intentar autenticación con Firebase Auth
    console.log("Intentando autenticación con Firebase Auth...");
    const userCredential = await signInWithEmailAndPassword(auth, correoSimulado, contrasena);
    const user = userCredential.user;
    
    console.log("✓ Autenticación exitosa con Firebase Auth");
    console.log("UID del usuario:", user.uid);

    // Obtener IP/ID del dispositivo actual
    const dispositivoActual = await obtenerIP();
    
    // Buscar usuario en ambas colecciones
    const resultadoBusqueda = await buscarUsuario(user.uid, nombreCompleto);

    if (resultadoBusqueda.existe) {
      console.log(`✓ Usuario encontrado como: ${resultadoBusqueda.tipo}`);
      const userData = resultadoBusqueda.datos;
      const docRef = resultadoBusqueda.docRef;
      
      console.log("Datos del usuario:", userData);
      
      const dispositivoRegistrado = userData.dispositivo_registrado;
      
      // Verificar dispositivo
      if (!dispositivoRegistrado) {
        // Primer login - registrar dispositivo
        await updateDoc(docRef, {
          dispositivo_registrado: dispositivoActual,
          ultima_actividad: serverTimestamp(),
          ip_registrada: dispositivoActual
        });
        
        console.log("✓ Dispositivo registrado exitosamente");
        
        // Redireccionar según el tipo de usuario
        if (resultadoBusqueda.tipo === 'profesor') {
          console.log("Redirigiendo a dashboard de profesores");
          alert("Login exitoso - Bienvenido Profesor");
          window.location.href = "profes.html"; // Cambia esta URL por la correcta
        } else {
          console.log("Redirigiendo a dashboard de alumnos");
          alert("Login exitoso - Bienvenido Alumno");
          window.location.href = "dashboard.html";
        }
        
      } else if (dispositivoRegistrado === dispositivoActual) {
        // Mismo dispositivo
        await updateDoc(docRef, {
          ultima_actividad: serverTimestamp()
        });
        
        console.log("✓ Acceso desde dispositivo autorizado");
        
        // Redireccionar según el tipo de usuario
        if (resultadoBusqueda.tipo === 'profesor') {
          console.log("Redirigiendo a dashboard de profesores");
          alert("Login exitoso - Bienvenido Profesor");
          window.location.href = "profes.html"; // Cambia esta URL por la correcta
        } else {
          console.log("Redirigiendo a dashboard de alumnos");
          alert("Login exitoso - Bienvenido Alumno");
          window.location.href = "dashboard.html";
        }
        
      } else {
        // Dispositivo diferente
        console.log("✗ Dispositivo no autorizado");
        console.log("Dispositivo registrado:", dispositivoRegistrado);
        console.log("Dispositivo actual:", dispositivoActual);
        alert("Esta cuenta ya está siendo utilizada en otro dispositivo. Solo se permite un dispositivo por cuenta.");
        await auth.signOut();
        return;
      }
      
    } else {
      console.log("✗ Usuario NO encontrado en ninguna colección");
      
      // DEBUG: Buscar si existe un documento con ese nombre
      const encontradoPorNombre = await debugBuscarPorNombre(nombreCompleto);
      
      if (encontradoPorNombre) {
        alert("ERROR: Los datos están mal configurados. El UID no coincide. Contacta al administrador.");
      } else {
        alert("DEBUG: Usuario no encontrado en base de datos. Verifica que el nombre esté exactamente igual.");
      }
      
      await auth.signOut();
    }
    
  } catch (error) {
    console.log("✗ Error en autenticación:");
    console.error(error);
    
    if (error.code === 'auth/user-not-found') {
      alert("ERROR: No existe una cuenta de Firebase Auth con ese email. El administrador debe crear la cuenta primero.");
    } else if (error.code === 'auth/wrong-password') {
      alert("ERROR: Contraseña incorrecta.");
    } else if (error.code === 'auth/invalid-email') {
      alert("ERROR: Email generado inválido: " + correoSimulado);
    } else {
      alert("Error de autenticación: " + error.message);
    }
  }
});

// Función para verificar sesión activa (modificada para soportar ambos tipos)
export async function verificarSesionDispositivo() {
  const user = auth.currentUser;
  if (!user) return false;
  
  try {
    const dispositivoActual = await obtenerIP();
    
    // Buscar en ambas colecciones
    const resultadoBusqueda = await buscarUsuario(user.uid, null);
    
    if (resultadoBusqueda.existe) {
      const userData = resultadoBusqueda.datos;
      if (userData.dispositivo_registrado !== dispositivoActual) {
        await auth.signOut();
        alert("Sesión cerrada: acceso detectado desde otro dispositivo.");
        window.location.href = "index.html";
        return false;
      }
      
      // Retornar información adicional sobre el tipo de usuario
      return {
        valida: true,
        tipo: resultadoBusqueda.tipo,
        datos: userData
      };
    }
    
    return false;
  } catch (error) {
    console.error("Error verificando sesión:", error);
    return false;
  }
}