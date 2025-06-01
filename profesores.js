import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { deleteDoc, doc ,getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";


// Variables globales
let asistenciasData = [];
let alumnosData = [];
let currentUser = null;
let timerInterval = null;


let refresh = document.getElementById('refresh');
refresh.addEventListener('click', _ => {
    location.reload();
})

// Horarios de clases
const horariosClases = {
    "Lunes": {
        "13:20-15:00": { materia: "M3S1", profesor: "Profa. Dalia" },
        "15:00-16:40": { materia: "Reacciones Quimicas", profesor: "Profa. Estela" },
        "17:10-18:50": { materia: "Orientación Educativa", profesor: " " },
        "18:50-20:30": { materia: "Consciencia Histórica 1", profesor: "Prof. Filiberto" }
    },
    "Martes": {
        "14:10-16:40": { materia: "M3S2", profesor: "Profa. Dalia" },
        "17:10-18:50": { materia: "Temas Selectos de Matematicas 1", profesor: "Prof. Razo" },
        "18:50-20:30": { materia: "M3S1", profesor: "Profa. Dalia" }
    },
    "Miércoles": {
        "14:10-16:40": { materia: "M3S1", profesor: "Profa. Dalia" },
        "17:10-18:50": { materia: "Ciencias Sociales 3", profesor: "Profa. Pily" },
        "18:50-20:30": { materia: "Temas Selectos de Matemáticas 1", profesor: "Prof. Razo" },
    },
    "Jueves": {
        "13:20-16:40": { materia: "M3S2", profesor: "Prof. Rodríguez" },
        "17:10-18:50": { materia: "Conciencia Historica 1", profesor: "Prof. Filiberto" },
        "18:50-19:40": { materia: "Tutorias", profesor: "Prof. Razo" },
        "19:40-20:30": { materia: "Ingle 4", profesor: "Prof. Juan" }
    },
    "Viernes": {
        "14:10-16:40": { materia: "M3S2", profesor: "Profa. Dalia" },
        "17:10-18:50": { materia: "Reacciones Quimicas", profesor: "Profa. Estela" },
        "18:50-20:30": { materia: "Ingles 4 ", profesor: "Prof. Juan" },
    }
};

// Lista de alumnos de ejemplo
const alumnosEjemplo = [
    { id: "1", nombre: "Tomas de la Cruz Christian" },
    { id: "2", nombre: "Bautista Martínez Jaime Josué" },
    { id: "3", nombre: "Cano Romero Keyvin Javier" },
    { id: "4", nombre: "Gaspar Serrano Zantiago" },
    { id: "5", nombre: "Gonzáles Oliver Isaac Alejandro" },
    { id: "6", nombre: "Hernández Olvera Luis Ángel" },
    { id: "7", nombre: "Márquez Hernández Ángel Josué" },
    { id: "8", nombre: "Mendazo Razo Vicente Kevin de Jesús" },
    { id: "9", nombre: "Montes Sandoval Fabián" },
    { id: "10", nombre: "Paredes Reyes Sven Farid" },
    { id: "11", nombre: "Quintanal Gonzáles Francisco" },
    { id: "12", nombre: "Ramírez Jasso Angie" },
    { id: "13", nombre: "Rosas Gonzáles Brandon Eduardo" },
    { id: "14", nombre: "Salgado Velázques Cristian Joel" },
    { id: "15", nombre: "Santiago Cruz Israel" },
    { id: "16", nombre: "Sánches Escamilla Cristopher" },   
    { id: "17", nombre: "Zea Paredes Armando" },
    { id: "18", nombre: "Rodrigo Yoltzin Macias Garcia" }
];

// Función para verificar si un elemento existe
function elementExists(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Elemento con ID '${id}' no encontrado`);
        return false;
    }
    return true;
}

// Función para obtener elemento de forma segura
function getElementSafely(id) {
    const element = document.getElementById(id);
    if (!element) {
        //console.warn(`Elemento con ID '${id}' no encontrado`);
    }
    return element;
}

// Inicialización
window.addEventListener('load', function() {
    inicializarPanel();
    cargarAsistencias();
    cargarHorarios();
    actualizarClaseActual();
    iniciarTimer();
    cargarAlumnosDesdeFirebase();
    
    // Establecer fecha actual en filtros - con verificación
    const fechaHoy = new Date().toISOString().split('T')[0];
    const filtroFecha = getElementSafely('filtroFecha');
    const modalFecha = getElementSafely('modalFecha');
    const fechaInicio = getElementSafely('fechaInicio');
    const fechaFin = getElementSafely('fechaFin');
    
    if (filtroFecha) filtroFecha.value = fechaHoy;
    if (modalFecha) modalFecha.value = fechaHoy;
    if (fechaInicio) fechaInicio.value = fechaHoy;
    if (fechaFin) fechaFin.value = fechaHoy;
    
    // Event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Filtros - con verificación de existencia
    const filtroFecha = getElementSafely('filtroFecha');
    const filtroClase = getElementSafely('filtroClase');
    const filtroEstado = getElementSafely('filtroEstado');
    
    if (filtroFecha) filtroFecha.addEventListener('change', filtrarAsistencias);
    if (filtroClase) filtroClase.addEventListener('change', filtrarAsistencias);
    if (filtroEstado) filtroEstado.addEventListener('change', filtrarAsistencias);
    
    // Botones del modal
    const guardarBtn = getElementSafely('guardarAsistencia');
    const cancelarBtn = getElementSafely('cancelarModal');
    
    if (guardarBtn) guardarBtn.addEventListener('click', guardarAsistencia);
    if (cancelarBtn) cancelarBtn.addEventListener('click', cerrarModal);
    
    // Generar reporte
    const reporteBtn = document.getElementById('generarReporte');
    if (reporteBtn) reporteBtn.addEventListener('click', generarReporte);
    
    // Cerrar modal al hacer clic fuera
    const modal = getElementSafely('modalAsistencia');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                cerrarModal();
            }
        });
    }

    // Logout button
    const logoutBtn = getElementSafely('logoutBtn');
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
}

async function inicializarPanel() {
    try{ 
    // Simular usuario autenticado
    currentUser = {
        name: "Profesor / Coordinador",
        role: "profesor"
    };
    
    const profesorNombre = getElementSafely('profesorNombre');
    if (profesorNombre) {
        profesorNombre.textContent = `👤 ${currentUser.name}`;
    }
    
    // Cargar opciones en los selects
    cargarOpcionesClases();
    cargarOpcionesAlumnos();
    
    // Generar datos de ejemplo
    generarDatosEjemplo();

     // 1. Cargar datos desde Firebase
        await cargarAsistenciasDesdeFirebase();
        await cargarAlumnosDesdeFirebase();
        
        // 2. Inicializar filtros y sus event listeners
        inicializarFiltros();
        
        // 3. Llenar las opciones de filtros
        llenarFiltroClases();
        cargarAlumnos(); // Para el modal
        cargarClases(); // Para el modal
        
        // 4. Mostrar datos iniciales
        actualizarTablaAsistencias();
        actualizarResumen();
        
        // 5. Inicializar otras funciones
        cargarHorarios();
    
    console.log("Panel inicializado correctamente");
    } catch (error) {
        console.error("Error inicializando el panel:", error);
    }
}

function generarDatosEjemplo() {
    // Generar algunas asistencias de ejemplo para demostración
    const fechaHoy = new Date().toISOString().split('T')[0];
    const claseActual = obtenerClaseActual();
    
    //asistenciasData = [
 
    //];
    
    actualizarTablaAsistencias();
}

function cargarOpcionesClases() {
    const clases = new Set();
    Object.values(horariosClases).forEach(dia => {
        Object.values(dia).forEach(clase => {
            clases.add(clase.materia);
        });
    });

    const selects = ['filtroClase', 'modalClase'];
    selects.forEach(selectId => {
        const select = getElementSafely(selectId);
        if (select) {
            select.innerHTML = '<option value="">Seleccionar clase...</option>';
            clases.forEach(clase => {
                select.innerHTML += `<option value="${clase}">${clase}</option>`;
            });
        }
    });
}

function cargarOpcionesAlumnos() {
    const select = getElementSafely('modalAlumno');
    if (select) {
        select.innerHTML = '<option value="">Seleccionar alumno...</option>';
        alumnosEjemplo.forEach(alumno => {
            select.innerHTML += `<option value="${alumno.nombre}">${alumno.nombre}</option>`;
        });
    }
}

function mostrarTab(tabName) {
    // Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remover clase active de todas las pestañas
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar el contenido seleccionado
    const tabContent = getElementSafely(tabName);
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // Activar la pestaña seleccionada
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // Si se selecciona la pestaña de horarios, cargar horarios
    if (tabName === 'horarios') {
        cargarHorarios();
    }
}

function obtenerClaseActual() {
    const ahora = new Date();
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const diaActual = dias[ahora.getDay()];
    const horaActual = ahora.getHours() * 100 + ahora.getMinutes();

    if (!horariosClases[diaActual]) {
        return { 
            dia: diaActual, 
            materia: "Sin clases", 
            profesor: "N/A", 
            horario: "N/A", 
            inicio: null, 
            fin: null 
        };
    }

    const horarios = horariosClases[diaActual];
    
    for (const [horario, info] of Object.entries(horarios)) {
        const [inicio, fin] = horario.split("-");
        const [horaInicio, minInicio] = inicio.split(":").map(Number);
        const [horaFin, minFin] = fin.split(":").map(Number);
        
        const inicioNum = horaInicio * 100 + minInicio;
        const finNum = horaFin * 100 + minFin;
        
        if (horaActual >= inicioNum && horaActual <= finNum) {
            return {
                dia: diaActual,
                materia: info.materia,
                profesor: info.profesor,
                horario: horario,
                inicio: new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), horaInicio, minInicio),
                fin: new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), horaFin, minFin)
            };
        }
    }
    
    return { 
        dia: diaActual, 
        materia: "Fuera de horario", 
        profesor: "N/A", 
        horario: "N/A", 
        inicio: null, 
        fin: null 
    };
}

function actualizarClaseActual() {
    const claseActual = obtenerClaseActual();
    
    const materiaActual = getElementSafely('materiaActual');
    const profesorActual = getElementSafely('profesorActual');
    const horarioActual = getElementSafely('horarioActual');
    const estadoElement = getElementSafely('estadoClase');
    
    if (materiaActual) materiaActual.textContent = claseActual.materia;
    if (profesorActual) profesorActual.textContent = claseActual.profesor;
    if (horarioActual) horarioActual.textContent = claseActual.horario;
    
    if (estadoElement) {
        if (claseActual.materia === "Sin clases") {
            estadoElement.textContent = " No hay clases programadas para hoy";
            estadoElement.style.color = "#6c757d";
        } else if (claseActual.materia === "Fuera de horario") {
            estadoElement.textContent = " Fuera del horario de clases";
            estadoElement.style.color = "#e0f208";
            estadoElement.style.fontWeight = "600";
        } else {
            estadoElement.textContent = " Clase en curso";
            estadoElement.style.color = "#000";
            estadoElement.style.fontWeight = "600";
            estadoElement.style.fontSize = "20px";
;        }
    }
}

function iniciarTimer() {
    timerInterval = setInterval(() => {
        const claseActual = obtenerClaseActual();
        const timerElement = getElementSafely('timerClase');
        
        if (!timerElement) return;
        
        if (claseActual.fin) {
            const ahora = new Date();
            const tiempoRestante = claseActual.fin - ahora;
            
            if (tiempoRestante > 0) {
                const horas = Math.floor(tiempoRestante / (1000 * 60 * 60));
                const minutos = Math.floor((tiempoRestante % (1000 * 60 * 60)) / (1000 * 60));
                const segundos = Math.floor((tiempoRestante % (1000 * 60)) / 1000);
                
                let timerText = "";
                if (horas > 0) {
                    timerText = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
                } else {
                    timerText = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
                }
                
                timerElement.textContent = ` Tiempo restante: ${timerText}`;
                timerElement.style.color = tiempoRestante < 300000 ? "#e11c1c" : "#000000"; // Rojo si quedan menos de 5 minutos
            } else {
                timerElement.textContent = " Clase terminada";
                timerElement.style.color = "#6c757d";
                // Actualizar información de clase actual
                actualizarClaseActual();
            }
        } else {
            timerElement.textContent = " Sin clase activa";
            timerElement.style.color = "#6c757d";
        }
        
        // Actualizar cada minuto la información de clase actual
        if (new Date().getSeconds() === 0) {
            actualizarClaseActual();
        }
    }, 1000);
}

function agregarAsistencia() {
    // Abrir el modal para agregar asistencia
    abrirModal("Agregar Asistencia");

    // Limpiar los campos del modal
    const modalAlumno = getElementSafely('modalAlumno');
    const modalFecha = getElementSafely('modalFecha');
    const modalClase = getElementSafely('modalClase');
    const modalEstado = getElementSafely('modalEstado');
    const modalHora = getElementSafely('modalHora');
    const modalObservaciones = getElementSafely('modalObservaciones');

    if (modalAlumno) modalAlumno.value = '';
    if (modalFecha) modalFecha.value = '';
    if (modalClase) modalClase.value = '';
    if (modalEstado) modalEstado.value = 'presente'; // Estado por defecto
    if (modalHora) modalHora.value = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (modalObservaciones) modalObservaciones.value = '';
}

// Función para cargar horarios
function cargarHorarios() {
    const container = getElementSafely('horariosContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    Object.entries(horariosClases).forEach(([dia, horarios]) => {
        const diaDiv = document.createElement('div');
        diaDiv.className = 'horario-dia';
        
        let horariosHTML = `<h3>${dia}</h3>`;
        
        if (Object.keys(horarios).length === 0) {
            horariosHTML += '<p class="sin-clases">Sin clases programadas</p>';
        } else {
            Object.entries(horarios).forEach(([horario, info]) => {
                horariosHTML += `
                    <div class="horario-item">
                        <div class="horario-tiempo">${horario}</div>
                        <div class="horario-info">
                            <div class="materia">${info.materia}</div>
                            <div class="profesor">${info.profesor}</div>
                        </div>
                    </div>
                `;
            });
        }
        
        diaDiv.innerHTML = horariosHTML;
        container.appendChild(diaDiv);
    });
}

function generarCSV(datos, fechaInicio, fechaFin) {
    const headers = ['Alumno', 'Fecha', 'Clase', 'Estado', 'Hora', 'Observaciones'];
    let csvContent = headers.join(',') + '\n';
    
    datos.forEach(asistencia => {
        const row = [
            `"${asistencia.alumno}"`,
            asistencia.fecha,
            `"${asistencia.clase}"`,
            asistencia.estado,
            asistencia.hora,
            `"${asistencia.observaciones}"`
        ];
        csvContent += row.join(',') + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_asistencias_${fechaInicio}_${fechaFin}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    mostrarNotificacion('Reporte generado y descargado correctamente', 'success');
}

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = 'info') {
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion ${tipo}`;
    notificacion.textContent = mensaje;
    
    notificacion.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    const colores = {
        'success': '#28a745',
        'error': '#dc3545',
        'warning': '#ffc107',
        'info': '#17a2b8'
    };
    
    notificacion.style.backgroundColor = colores[tipo] || colores.info;
    
    document.body.appendChild(notificacion);
    
    // Animar entrada
    setTimeout(() => {
        notificacion.style.opacity = '1';
        notificacion.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-ocultar después de 3 segundos
    setTimeout(() => {
        notificacion.style.opacity = '0';
        notificacion.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (document.body.contains(notificacion)) {
                document.body.removeChild(notificacion);
            }
        }, 300);
    }, 3000);
}

// Función para limpiar timer al salir de la página
window.addEventListener('beforeunload', function() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
});

async function cargarAsistencias() {
    try {
        const querySnapshot = await getDocs(collection(db, "asistencias"));
        asistenciasData = []; // Limpiar el array de asistencias

        querySnapshot.forEach((doc) => {
            const asistencia = doc.data();
            asistencia.id = doc.id; // Agregar el ID del documento
            asistenciasData.push(asistencia);
        });

        // Actualizar la tabla de asistencias después de cargar los datos
        actualizarTablaAsistencias();
    } catch (error) {
        console.error("Error cargando asistencias:", error);
    }
}

function filtrarAsistenciasData() {
    const filtroFecha = getElementSafely('filtroFecha');
    const filtroClase = getElementSafely('filtroClase');
    const filtroEstado = getElementSafely('filtroEstado');
    
    const fechaValue = filtroFecha ? filtroFecha.value : '';
    const claseValue = filtroClase ? filtroClase.value : '';
    const estadoValue = filtroEstado ? filtroEstado.value : '';

    return asistenciasData.filter(asistencia => {
        const coincideFecha = !fechaValue || asistencia.fecha === fechaValue;
        const coincideClase = !claseValue || asistencia.clase === claseValue;
        const coincideEstado = !estadoValue || asistencia.estado === estadoValue;

        return coincideFecha && coincideClase && coincideEstado;
    });
}


function actualizarEstadisticas(total, presentes, ausentes, tardes) {
    const totalAlumnos = getElementSafely('totalAlumnos');
    const totalPresentes = getElementSafely('totalPresentes');
    const totalAusentes = getElementSafely('totalAusentes');
    const totalTardes = getElementSafely('totalTardes');
    const porcentajeAsistencia = getElementSafely('porcentajeAsistencia');

    if (totalAlumnos) totalAlumnos.textContent = total;
    if (totalPresentes) totalPresentes.textContent = presentes;
    if (totalAusentes) totalAusentes.textContent = ausentes;
    if (totalTardes) totalTardes.textContent = tardes;

    // Calcular porcentaje de asistencia
    const porcentaje = total > 0 ? Math.round((presentes / total) * 100) : 0;
    if (porcentajeAsistencia) porcentajeAsistencia.textContent = `${porcentaje}%`;
}

window.addEventListener('load', function() {
    inicializarPanel();
    cargarAlumnos();
    cargarClases();
});

// Función para actualizar la tabla de asistencias
function actualizarTablaAsistencias(datosParaMostrar = asistenciasData) {
    const tbody = document.getElementById('bodyAsistencias');
    if (!tbody) return;

    tbody.innerHTML = ''; // Limpiar la tabla
    
    // Si no hay datos para mostrar
    if (datosParaMostrar.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 20px; color: #666;">
                    No se encontraron asistencias con los filtros aplicados
                </td>
            </tr>
        `;
        return;
    }

    // Usar los datos que se pasan como parámetro (datos filtrados o todos)
    datosParaMostrar.forEach(asistencia => {
        const row = document.createElement('tr');
        const estadoClass = {
            'presente': 'badge-success',
            'tarde': 'badge-warning',
            'ausente': 'badge-danger'
        };
        
        const estadoIcon = {
            'presente': '✅',
            'tarde': '⚠️',
            'ausente': '❌'
        };

        row.innerHTML = `
            <td>${asistencia.alumno}</td>
            <td>${asistencia.clase}</td>
            <td>${asistencia.fecha}</td>
            <td>${asistencia.hora}</td>
            <td>
                <span class="badge ${estadoClass[asistencia.estado]}">
                    ${estadoIcon[asistencia.estado]} ${asistencia.estado.charAt(0).toUpperCase() + asistencia.estado.slice(1)}
                </span>
            </td>
            <td>
                <button onclick="editarAsistencia('${asistencia.id}')" class="btn-action btn-edit" title="Editar">
                    ✏️
                </button>
                <button onclick="eliminarAsistencia('${asistencia.id}')" class="btn-action btn-delete" title="Eliminar">
                    🗑️
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

// Exportar función al scope global
window.actualizarTablaAsistencias = actualizarTablaAsistencias;

async function cargarAlumnosDesdeFirebase() {
    try {
        const querySnapshot = await getDocs(collection(db, "alumnos"));
        alumnosData = []; // Limpiar array
        querySnapshot.forEach((doc) => {
            alumnosData.push({
                id: doc.id,
                ...doc.data()
            });
        });
        console.log('Alumnos cargados desde Firebase:', alumnosData);
    } catch (error) {
        console.error('Error cargando alumnos:', error);
    }
}


function cargarAlumnos() {
    console.log('alumnosData:', alumnosData); // ← Ver qué contiene
    console.log('alumnosData.length:', alumnosData.length); // ← Ver el tamaño
    
    const select = document.getElementById('modalAlumno');
    if (select) {
        select.innerHTML = '<option value="">Seleccionar alumno...</option>';
        const datosAUsar = alumnosData.length > 0 ? alumnosData : alumnosEjemplo;
        console.log('Usando datos:', datosAUsar); // ← Ver qué datos usa
        datosAUsar.forEach(alumno => {
            select.innerHTML += `<option value="${alumno.nombre}">${alumno.nombre}</option>`;
        });
    }
}

// Función para cargar clases en el modal
function cargarClases() {
    const select = document.getElementById('modalClase');
    if (select) {
        select.innerHTML = '<option value="">Seleccionar clase...</option>';
        Object.values(horariosClases).forEach(dia => {
            Object.values(dia).forEach(clase => {
                select.innerHTML += `<option value="${clase.materia}">${clase.materia}</option>`;
            });
        });
    }
}

// Función para editar asistencia (función que faltaba)
function editarAsistencia(id) {
    cargarAlumnos();
    const asistencia = asistenciasData.find(a => a.id === id);
    if (!asistencia) {
        alert('Asistencia no encontrada');
        return;
    }

    // Llenar el modal con los datos de la asistencia
    document.getElementById('modalAlumno').value = asistencia.alumno;
    document.getElementById('modalClase').value = asistencia.clase;
    document.getElementById('modalFecha').value = asistencia.fecha;
    document.getElementById('modalHora').value = asistencia.hora;
    
    // Cambiar el título del modal
    document.getElementById('tituloModal').textContent = 'Editar Asistencia';
    
    // Abrir el modal
    abrirModal();
}

// Exportar función al scope global
window.editarAsistencia = editarAsistencia;

// Función para abrir el modal
function abrirModal() {
    const modal = document.getElementById('modalAsistencia');
    if (modal) modal.style.display = 'flex';
}

// Exportar función al scope global
window.abrirModal = abrirModal;

// Función para cerrar el modal
function cerrarModal() {
    const modal = document.getElementById('modalAsistencia');
    if (modal) modal.style.display = 'none';
    
    // Limpiar el formulario
    document.getElementById('modalAlumno').value = '';
    document.getElementById('modalClase').value = '';
    document.getElementById('modalFecha').value = '';
    document.getElementById('modalHora').value = '';
    document.getElementById('tituloModal').textContent = 'Agregar Asistencia Manual';
}

// Exportar función al scope global
window.cerrarModal = cerrarModal;

// Función para guardar asistencia
async function guardarAsistencia() {
    const modalAlumno = document.getElementById('modalAlumno');
    const modalFecha = document.getElementById('modalFecha');
    const modalClase = document.getElementById('modalClase');
    const modalHora = document.getElementById('modalHora');

    // Validar que los campos necesarios estén presentes
    if (!modalAlumno || !modalFecha || !modalClase || !modalHora) {
        alert('Error: Por favor completa todos los campos del formulario');
        return;
    }

    const alumno = modalAlumno.value;
    const fecha = modalFecha.value;
    const clase = modalClase.value;
    const hora = modalHora.value;

    // Validar que los campos tengan valores
    if (!alumno || !fecha || !clase || !hora) {
        alert('Por favor completa todos los campos');
        return;
    }

    // Crear un objeto de asistencia
    const nuevaAsistencia = {
        alumno,
        fecha,
        clase,
        hora,
        estado: 'presente', // Estado por defecto
        createdAt: new Date() // Agregar la fecha de creación
    };

    try {
        // Guardar en Firestore
        const docRef = await addDoc(collection(db, "asistencias"), nuevaAsistencia);
        nuevaAsistencia.id = docRef.id; // Agregar el ID del documento a la asistencia
        asistenciasData.push(nuevaAsistencia); // Agregar a la lista de asistencias

        // Actualizar la tabla de asistencias
        actualizarTablaAsistencias();

        alert('Asistencia agregada correctamente');
        cerrarModal();
    } catch (error) {
        console.error('Error guardando la asistencia:', error);
        alert('Fallo al registrar asistencia: ' + error.message);
    }
}

// Exportar función al scope global
window.guardarAsistencia = guardarAsistencia;

// Función para eliminar asistencia
async function eliminarAsistencia(id) {
    const confirmacion = confirm("¿Estás seguro de que deseas eliminar esta asistencia?");
    if (!confirmacion) return;
    
    try {
        // Eliminar de Firestore
        await deleteDoc(doc(db, "asistencias", id));
        // Eliminar de la lista local
        asistenciasData = asistenciasData.filter(a => a.id !== id);
        // Actualizar la tabla de asistencias
        actualizarTablaAsistencias();
        alert('Asistencia eliminada correctamente');
    } catch (error) {
        console.error('Error eliminando la asistencia:', error);
        alert('Fallo al eliminar la asistencia: ' + error.message);
    }
}

// Exportar función al scope global
window.eliminarAsistencia = eliminarAsistencia;


// Exportar función al scope global
window.inicializarPanel = inicializarPanel;


// Exportar función al scope global
window.mostrarTab = mostrarTab;

function filtrarAsistencias() {
    const filtroFecha = document.getElementById('filtroFecha');
    const filtroClase = document.getElementById('filtroClase');
    const filtroEstado = document.getElementById('filtroEstado');
    
    // Obtener valores de los filtros
    const fechaFiltro = filtroFecha ? filtroFecha.value : '';
    const claseFiltro = filtroClase ? filtroClase.value : '';
    const estadoFiltro = filtroEstado ? filtroEstado.value : '';
    
    console.log('Filtros aplicados:', { fechaFiltro, claseFiltro, estadoFiltro });
    
    // Filtrar los datos
    const asistenciasFiltradas = asistenciasData.filter(asistencia => {
        let cumpleFiltros = true;
        
        // Filtro por fecha
        if (fechaFiltro && asistencia.fecha !== fechaFiltro) {
            cumpleFiltros = false;
        }
        
        // Filtro por clase
        if (claseFiltro && asistencia.clase !== claseFiltro) {
            cumpleFiltros = false;
        }
        
        // Filtro por estado
        if (estadoFiltro && asistencia.estado !== estadoFiltro) {
            cumpleFiltros = false;
        }
        
        return cumpleFiltros;
    });
    
    console.log('Datos filtrados:', asistenciasFiltradas);
    
    // Actualizar la tabla con los datos filtrados
    actualizarTablaAsistencias(asistenciasFiltradas);
    
    // Actualizar estadísticas con datos filtrados
    actualizarResumen(asistenciasFiltradas);
}

// function actualizarResumen(datos = asistenciasData) {
//     const presentes = datos.filter(a => a.estado === 'presente').length;
//     const ausentes = datos.filter(a => a.estado === 'ausente').length;
//     const tardes = datos.filter(a => a.estado === 'tarde').length;
//     const total = datos.length;
//     const porcentaje = total > 0 ? Math.round((presentes / total) * 100) : 0;
    
//     const totalAlumnos = document.getElementById('totalAlumnos');
//     const totalPresentes = document.getElementById('totalPresentes');
//     const totalAusentes = document.getElementById('totalAusentes');
//     const totalTardes = document.getElementById('totalTardes');
//     const porcentajeAsistencia = document.getElementById('porcentajeAsistencia');

//     if (totalAlumnos) totalAlumnos.textContent = total;
//     if (totalPresentes) totalPresentes.textContent = presentes;
//     if (totalAusentes) totalAusentes.textContent = ausentes;
//     if (totalTardes) totalTardes.textContent = tardes;
//     if (porcentajeAsistencia) porcentajeAsistencia.textContent = porcentaje + '%';
// }

// Función para inicializar los event listeners de los filtros
function inicializarFiltros() {
    const filtroFecha = document.getElementById('filtroFecha');
    const filtroClase = document.getElementById('filtroClase');
    const filtroEstado = document.getElementById('filtroEstado');

    // Agregar event listeners para filtrar automáticamente
    if (filtroFecha) {
        filtroFecha.addEventListener('change', filtrarAsistencias);
    }
    if (filtroClase) {
        filtroClase.addEventListener('change', filtrarAsistencias);
    }
    if (filtroEstado) {
        filtroEstado.addEventListener('change', filtrarAsistencias);
    }
}

// Función para llenar el filtro de clases
function llenarFiltroClases() {
    const filtroClase = document.getElementById('filtroClase');
    if (!filtroClase) return;
    
    filtroClase.innerHTML = '<option value="">Todas las clases</option>';
    
    // Obtener clases únicas de los datos de asistencias
    const clasesUnicas = [...new Set(asistenciasData.map(a => a.clase))];
    
    clasesUnicas.forEach(clase => {
        if (clase) { // Solo agregar si la clase no es vacía
            filtroClase.innerHTML += `<option value="${clase}">${clase}</option>`;
        }
    });
}

// Función para limpiar filtros
function limpiarFiltros() {
    const filtroFecha = document.getElementById('filtroFecha');
    const filtroClase = document.getElementById('filtroClase');
    const filtroEstado = document.getElementById('filtroEstado');

    if (filtroFecha) filtroFecha.value = '';
    if (filtroClase) filtroClase.value = '';
    if (filtroEstado) filtroEstado.value = '';
    
    // Mostrar todos los datos
    actualizarTablaAsistencias(asistenciasData);
    actualizarResumen(asistenciasData);
}

// Exportar funciones al scope global
window.filtrarAsistencias = filtrarAsistencias;
window.actualizarTablaAsistencias = actualizarTablaAsistencias;
window.actualizarResumen = actualizarResumen;
window.inicializarFiltros = inicializarFiltros;
window.llenarFiltroClases = llenarFiltroClases;
window.limpiarFiltros = limpiarFiltros;

// Llamar inicializarFiltros cuando se cargue la página
document.addEventListener('DOMContentLoaded', function() {
    inicializarFiltros();
});

// Función para cargar asistencias desde Firebase
async function cargarAsistenciasDesdeFirebase() {
    try {
        const querySnapshot = await getDocs(collection(db, "asistencias"));
        asistenciasData = []; // Limpiar array
        querySnapshot.forEach((doc) => {
            asistenciasData.push({
                id: doc.id,
                ...doc.data()
            });
        });
        console.log('Asistencias cargadas desde Firebase:', asistenciasData);
        
        // Después de cargar, actualizar el filtro de clases
        llenarFiltroClases();
    } catch (error) {
        console.error('Error cargando asistencias:', error);
        // Si hay error, usar datos de ejemplo si existen
        if (typeof asistenciasEjemplo !== 'undefined') {
            asistenciasData = asistenciasEjemplo;
            llenarFiltroClases();
        }
    }
}

// Llamar cuando se cargue la página
window.addEventListener('load', function() {
    inicializarPanel();
});

// Función para marcar ausentes automáticamente (ADAPTADA A TU CÓDIGO EXISTENTE)
async function marcarAusentes(fecha = null, clase = null) {
    if (!fecha) {
        fecha = new Date().toISOString().split('T')[0]; // Fecha de hoy por defecto
    }
    
    try {
        // Si no se especifica clase, usar tu función existente obtenerClaseActual()
        if (!clase) {
            const claseActual = obtenerClaseActual(); // Usa TU función existente
            if (!claseActual || claseActual.materia === "Sin clases" || claseActual.materia === "Fuera de horario") {
                alert('No hay clase activa en este momento');
                console.log('No hay clase activa en este momento');
                return;
            }
            clase = claseActual.materia;
        }
        
        console.log(`Marcando ausentes para: ${clase} - ${fecha}`);
        
        // Obtener todos los alumnos
        const todosLosAlumnos = alumnosData.length > 0 ? alumnosData : alumnosEjemplo;
        
        if (!todosLosAlumnos || todosLosAlumnos.length === 0) {
            alert('No hay lista de alumnos disponible');
            return;
        }
        
        // Obtener asistencias existentes para esta fecha y clase
        const asistenciasExistentes = asistenciasData.filter(a => 
            a.fecha === fecha && a.clase === clase
        );
        
        console.log('Asistencias existentes:', asistenciasExistentes);
        
        // Encontrar alumnos que no tienen asistencia registrada
        const alumnosPresentes = asistenciasExistentes.map(a => a.alumno);
        const alumnosAusentes = todosLosAlumnos.filter(alumno => 
            !alumnosPresentes.includes(alumno.nombre)
        );
        
        console.log('Alumnos ausentes encontrados:', alumnosAusentes);
        
        if (alumnosAusentes.length === 0) {
            alert('Todos los estudiantes ya tienen asistencia registrada para esta clase');
            return;
        }
        
        // Confirmar antes de marcar ausentes
        const confirmacion = confirm(
            `¿Deseas marcar como AUSENTES a ${alumnosAusentes.length} estudiantes que no tienen registro para la clase de ${clase}?\n\n` +
            `Estudiantes a marcar: ${alumnosAusentes.map(a => a.nombre).join(', ')}`
        );
        
        if (!confirmacion) {
            return;
        }
        
        // Marcar como ausentes a los que no tienen registro
        let marcadosExitosamente = 0;
        
        for (const alumno of alumnosAusentes) {
            const nuevaAsistencia = {
                alumno: alumno.nombre,
                fecha: fecha,
                clase: clase,
                hora: new Date().toLocaleTimeString('es-ES', { hour12: false }).substring(0, 5),
                estado: 'ausente',
                marcadoAutomaticamente: true,
                createdAt: new Date()
            };
            
            try {
                // Guardar en Firestore
                const docRef = await addDoc(collection(db, "asistencias"), nuevaAsistencia);
                nuevaAsistencia.id = docRef.id;
                
                // Agregar al array local
                asistenciasData.push(nuevaAsistencia);
                marcadosExitosamente++;
                
                console.log(`Marcado como ausente: ${alumno.nombre}`);
            } catch (error) {
                console.error(`Error marcando ausente a ${alumno.nombre}:`, error);
            }
        }
        
        // Actualizar la interfaz
        actualizarTablaAsistencias();
        actualizarResumen();
        llenarFiltroClases();
        
        alert(`✅ Se marcaron ${marcadosExitosamente} estudiantes como ausentes para la clase de ${clase}`);
        
    } catch (error) {
        console.error('Error marcando ausentes:', error);
        alert('❌ Error al marcar ausentes: ' + error.message);
    }
}

// Función para marcar ausentes al final de la clase (ADAPTADA)
function marcarAusentesFinClase() {
    const claseActual = obtenerClaseActual(); // Usa TU función existente
    
    if (!claseActual || claseActual.materia === "Sin clases" || claseActual.materia === "Fuera de horario") {
        alert('No hay una clase activa en este momento');
        return;
    }
    
    const confirmacion = confirm(
        `¿Deseas marcar como ausentes a los estudiantes que no asistieron a la clase actual?\n\n` +
        `Clase: ${claseActual.materia}\n` +
        `Profesor: ${claseActual.profesor}\n` +
        `Horario: ${claseActual.horario}`
    );
    
    if (confirmacion) {
        marcarAusentes(null, claseActual.materia);
    }
}

// Función para marcar ausentes por fecha y clase específica
function marcarAusentesPersonalizado() {
    const fecha = prompt('Ingresa la fecha (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!fecha) return;
    
    // Validar formato de fecha
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fecha)) {
        alert('Formato de fecha inválido. Usa YYYY-MM-DD');
        return;
    }
    
    const clase = prompt('Ingresa el nombre de la clase:');
    if (!clase) return;
    
    marcarAusentes(fecha, clase);
}

// Función para verificar ausencias programáticamente (sin interferir con tu timer existente)
function verificarYMarcarAusentes() {
    const claseActual = obtenerClaseActual(); // Usa TU función existente
    
    if (claseActual && claseActual.materia !== "Sin clases" && claseActual.materia !== "Fuera de horario") {
        // Verificar si la clase está por terminar (últimos 5 minutos)
        const ahora = new Date();
        const finClase = claseActual.fin;
        
        if (finClase) {
            const tiempoRestante = finClase.getTime() - ahora.getTime();
            const minutosRestantes = Math.floor(tiempoRestante / (1000 * 60));
            
            // Si quedan 5 minutos o menos, ofrecer marcar ausentes
            if (minutosRestantes <= 5 && minutosRestantes > 0) {
                const pregunta = confirm(
                    `La clase de ${claseActual.materia} está por terminar en ${minutosRestantes} minutos.\n\n` +
                    `¿Deseas marcar ausentes ahora?`
                );
                
                if (pregunta) {
                    marcarAusentes(null, claseActual.materia);
                }
            }
        }
    }
}

// Función para obtener estadísticas de ausencias por alumno
function obtenerEstadisticasAusencias(fechaInicio = null, fechaFin = null) {
    let asistenciasFiltradas = asistenciasData;
    
    if (fechaInicio) {
        asistenciasFiltradas = asistenciasFiltradas.filter(a => a.fecha >= fechaInicio);
    }
    if (fechaFin) {
        asistenciasFiltradas = asistenciasFiltradas.filter(a => a.fecha <= fechaFin);
    }
    
    const estadisticas = {};
    
    asistenciasFiltradas.forEach(asistencia => {
        if (!estadisticas[asistencia.alumno]) {
            estadisticas[asistencia.alumno] = {
                presente: 0,
                ausente: 0,
                tarde: 0,
                total: 0
            };
        }
        
        estadisticas[asistencia.alumno][asistencia.estado]++;
        estadisticas[asistencia.alumno].total++;
    });
    
    return estadisticas;
}

// Función para mostrar reporte de ausencias
function mostrarReporteAusencias() {
    const estadisticas = obtenerEstadisticasAusencias();
    
    if (Object.keys(estadisticas).length === 0) {
        alert('No hay datos de asistencia para generar el reporte');
        return;
    }
    
    let reporte = '📊 REPORTE DE AUSENCIAS:\n\n';
    
    // Ordenar por porcentaje de ausencias (de mayor a menor)
    const alumnosOrdenados = Object.entries(estadisticas).sort((a, b) => {
        const porcentajeA = (a[1].ausente / a[1].total) * 100;
        const porcentajeB = (b[1].ausente / b[1].total) * 100;
        return porcentajeB - porcentajeA;
    });
    
    alumnosOrdenados.forEach(([alumno, stats]) => {
        const porcentajeAusencias = ((stats.ausente / stats.total) * 100).toFixed(1);
        const porcentajeAsistencia = (((stats.presente + stats.tarde) / stats.total) * 100).toFixed(1);
        
        reporte += `👤 ${alumno}:\n`;
        reporte += `    Presentes: ${stats.presente}\n`;
        reporte += `    Ausentes: ${stats.ausente} (${porcentajeAusencias}%)\n`;
        reporte += `    Tardes: ${stats.tarde}\n`;
        reporte += `    Asistencia: ${porcentajeAsistencia}%\n`;
        reporte += `    Total clases: ${stats.total}\n\n`;
    });
    
    alert(reporte);
}

// Exportar funciones al scope global
window.marcarAusentes = marcarAusentes;
window.marcarAusentesFinClase = marcarAusentesFinClase;
window.marcarAusentesPersonalizado = marcarAusentesPersonalizado;
window.verificarYMarcarAusentes = verificarYMarcarAusentes;
window.obtenerEstadisticasAusencias = obtenerEstadisticasAusencias;
window.mostrarReporteAusencias = mostrarReporteAusencias;
// Inicializar verificación automática cuando se carga la página



// Función mejorada para actualizar estadísticas con más detalles
function actualizarResumenDetallado(datos = asistenciasData) {
    // Filtrar datos de hoy si no se especifica otra cosa
    const hoy = new Date().toISOString().split('T')[0];
    const datosHoy = datos.filter(a => a.fecha === hoy);
    
    // Contar por estado
    const presentes = datosHoy.filter(a => a.estado === 'presente').length;
    const ausentes = datosHoy.filter(a => a.estado === 'ausente').length;
    const tardes = datosHoy.filter(a => a.estado === 'tarde').length;
    const total = datosHoy.length;
    
    // Calcular porcentaje de asistencia (presentes + tardes = asistieron)
    const asistieron = presentes + tardes;
    const porcentaje = total > 0 ? Math.round((asistieron / total) * 100) : 0;
    
    // Actualizar elementos del DOM
    const elementos = {
        'totalAlumnos': total,
        'totalPresentes': presentes,
        'totalAusentes': ausentes,
        'totalTardes': tardes,
        'porcentajeAsistencia': porcentaje + '%'
    };
    
    Object.entries(elementos).forEach(([id, valor]) => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = valor;
            
            // Agregar efectos visuales según el valor
            if (id === 'porcentajeAsistencia') {
                elemento.parentElement.style.background = 
                    porcentaje >= 80 ? '#d4edda' : 
                    porcentaje >= 60 ? '#fff3cd' : '#f8d7da';
                elemento.parentElement.style.color = 
                    porcentaje >= 80 ? '#155724' : 
                    porcentaje >= 60 ? '#856404' : '#721c24';
            }
        }
    });
    
    // Mostrar alertas si hay muchas ausencias
    if (total > 0 && (ausentes / total) > 0.3) {
        mostrarAlertaAusencias(ausentes, total);
    }
}

// Función para mostrar alerta de ausencias altas
function mostrarAlertaAusencias(ausentes, total) {
    const porcentajeAusencias = Math.round((ausentes / total) * 100);
    
    // Crear o actualizar elemento de alerta
    let alerta = document.getElementById('alertaAusencias');
    if (!alerta) {
        alerta = document.createElement('div');
        alerta.id = 'alertaAusencias';
        alerta.style.cssText = `
            background: #f8d7da;
            color: #721c24;
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
            border: 1px solid #f5c6cb;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;
        
        const resumenContainer = document.querySelector('.form-container');
        if (resumenContainer) {
            resumenContainer.appendChild(alerta);
        }
    }
    

}

// Función para obtener resumen de asistencia por clase
function obtenerResumenPorClase(fecha = null) {
    if (!fecha) {
        fecha = new Date().toISOString().split('T')[0];
    }
    
    const asistenciasFecha = asistenciasData.filter(a => a.fecha === fecha);
    const resumenPorClase = {};
    
    asistenciasFecha.forEach(asistencia => {
        if (!resumenPorClase[asistencia.clase]) {
            resumenPorClase[asistencia.clase] = {
                presente: 0,
                ausente: 0,
                tarde: 0,
                total: 0
            };
        }
        
        resumenPorClase[asistencia.clase][asistencia.estado]++;
        resumenPorClase[asistencia.clase].total++;
    });
    
    return resumenPorClase;
}


// Función para mostrar resumen detallado por clase
function mostrarResumenPorClase() {
    const resumen = obtenerResumenPorClase();
    let mensaje = 'RESUMEN POR CLASE (HOY):\n\n';
    
    if (Object.keys(resumen).length === 0) {
        mensaje += 'No hay asistencias registradas para hoy.';
    } else {
        Object.entries(resumen).forEach(([clase, stats]) => {
            const porcentaje = Math.round(((stats.presente + stats.tarde) / stats.total) * 100);
            mensaje += `📚 ${clase}:\n`;
            mensaje += `   ✅ Presentes: ${stats.presente}\n`;
            mensaje += `   ❌ Ausentes: ${stats.ausente}\n`;
            mensaje += `   ⚠️ Tardes: ${stats.tarde}\n`;
            mensaje += `   📊 Asistencia: ${porcentaje}%\n\n`;
        });
    }
    
    alert(mensaje);
}

// Actualizar la función de resumen original para usar la nueva
function actualizarResumen(datos = asistenciasData) {
    actualizarResumenDetallado(datos);
}

// Exportar nuevas funciones
window.actualizarResumenDetallado = actualizarResumenDetallado;
window.obtenerResumenPorClase = obtenerResumenPorClase;
window.mostrarResumenPorClase = mostrarResumenPorClase;
window.mostrarAlertaAusencias = mostrarAlertaAusencias;