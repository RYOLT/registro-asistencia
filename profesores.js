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
    },
    "Sábado,Domingo": {
        "09:20-02:00": { materia: "Pruebas", profesor: "Profa. Yo" }
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

function inicializarPanel() {
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
    const asistenciasFiltradas = filtrarAsistenciasData();



    asistenciasData.forEach(asistencia => {
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
    
    // Filtrar los datos
    let asistenciasFiltradas = asistenciasData.filter(asistencia => {
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
    
    // Actualizar la tabla con los datos filtrados
    actualizarTablaAsistencias(asistenciasFiltradas);
    
    // Actualizar resumen con datos filtrados
    actualizarResumen(asistenciasFiltradas);
}

function actualizarResumen(datos = asistenciasData) {
    const presentes = datos.filter(a => a.estado === 'presente').length;
    const ausentes = datos.filter(a => a.estado === 'ausente').length;
    const tardes = datos.filter(a => a.estado === 'tarde').length;
    const total = datos.length;
    const porcentaje = total > 0 ? Math.round((presentes / total) * 100) : 0;
    
    document.getElementById('totalPresentes').textContent = presentes;
    document.getElementById('totalAusentes').textContent = ausentes;
    document.getElementById('totalTardes').textContent = tardes;
    document.getElementById('totalAlumnos').textContent = total;
    document.getElementById('porcentajeAsistencia').textContent = porcentaje + '%';
}