// ===== VARIABLES GLOBALES =====
let vozBaymax = null;
let stream = null;
let camaraActiva = true;
let vistaCamaraVisible = true;
let canvas = null;
let saludoNeutralDado = false;
let lastEmotion = '';

// ===== CONFIGURAR VOZ =====
window.speechSynthesis.onvoiceschanged = () => {
  const voces = speechSynthesis.getVoices();
  vozBaymax = voces.find(v => v.name.includes('Google') && v.lang.includes('es')) 
           || voces.find(v => v.lang === 'es-ES') 
           || voces[0];
};

function hablarComoBaymax(texto) {
  const utterance = new SpeechSynthesisUtterance(texto);
  if (vozBaymax) utterance.voice = vozBaymax;
  utterance.pitch = 0.8;
  utterance.rate = 0.9;
  speechSynthesis.speak(utterance);

  const mensajeDiv = document.getElementById('mensaje');
  mensajeDiv.style.display = 'block';
  mensajeDiv.textContent = texto;
  setTimeout(() => {
    mensajeDiv.style.display = 'none';
  }, 4000);
}

// ===== INICIO =====
async function start() {
  try {
    // Cargar modelos de face-api.js
    await faceapi.nets.tinyFaceDetector.loadFromUri('models/tiny_face_detector');
    await faceapi.nets.faceExpressionNet.loadFromUri('models/face_expression');
    console.log("Modelos cargados exitosamente");
  } catch (error) {
    console.error("Error al cargar los modelos:", error);
  }

  // Iniciar cámara
  startVideo();
}

// ===== CÁMARA =====
async function startVideo() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.getElementById('video');
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    console.error('Error accediendo a la cámara:', err);
    alert('No se pudo acceder a la cámara. Revisa permisos y conexión segura (HTTPS o localhost).');
  }
}

function toggleVistaCamara() {
  const video = document.getElementById('video');
  vistaCamaraVisible = !vistaCamaraVisible;
  video.style.display = vistaCamaraVisible ? 'block' : 'none';
}

function toggleCamaraActiva() {
  const video = document.getElementById('video');

  if (camaraActiva) {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    if (canvas) {
      canvas.remove();
      canvas = null;
    }
    camaraActiva = false;
    hablarComoBaymax("He apagado la cámara, pero sigo aquí para ayudarte.");
  } else {
    lastEmotion = '';
    saludoNeutralDado = false;
    startVideo();
    camaraActiva = true;
    hablarComoBaymax("Cámara activada. Continuando con el análisis.");
  }
}

// ===== DETECCIÓN DE EMOCIONES =====
const video = document.getElementById('video');
video.addEventListener('canplay', () => {
  const width = 640;
  const height = 480;
  video.width = width;
  video.height = height;

  if (canvas) canvas.remove();
  canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);

  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  const respuestasPorEmocion = {
    happy: ['¡Me alegra verte feliz!', 'Tu sonrisa mejora mi día.', 'Qué felicidad verte así.'],
    sad: ['Parece que estás triste, estoy aquí para ti.', 'Si necesitas hablar, estoy listo para escucharte.', 'No estás solo, estoy contigo.'],
    angry: ['Respira profundo, todo estará bien.', 'Sé que estás molesto, pero estoy aquí para ayudarte.', 'Calma, juntos podemos solucionarlo.'],
    neutral: ['Hola, ¿cómo estás hoy?', 'Recuerda que estoy aquí para ayudarte.', '¿En qué puedo ayudarte hoy?'],
    surprised: ['¡Wow! ¿Qué te sorprendió?', 'Parece que algo inesperado pasó.', 'Esa cara me dice que viste algo interesante.'],
    disgusted: ['¿Algo no te gusta? Puedes decírmelo.', 'Tu cara lo dice todo, ¿qué pasó?', 'Parece que viste algo desagradable.'],
    fearful: ['No tengas miedo, estoy contigo.', 'Todo estará bien, estoy aquí para ayudarte.', 'Puedes confiar en mí.'],
    default: ['Hola, ¿cómo estás?']
  };

  setInterval(async () => {
    if (!camaraActiva) return;

    try {
      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

      if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

        const expressions = detections.expressions;
        const maxExpression = Object.entries(expressions).reduce((a, b) => a[1] > b[1] ? a : b)[0];

        if (maxExpression !== lastEmotion) {
          baymaxHablarSegunEmocion(maxExpression, respuestasPorEmocion);
          lastEmotion = maxExpression;
        }
      }
    } catch (error) {
      console.error("Error al procesar las detecciones:", error);
    }
  }, 1500);
});

function baymaxHablarSegunEmocion(emocion, respuestasPorEmocion) {
  let frases = respuestasPorEmocion[emocion] || respuestasPorEmocion['default'];

  if (emocion === 'neutral') {
    if (!saludoNeutralDado) {
      saludoNeutralDado = true;
    } else {
      frases = frases.slice(1);
    }
  }

  const frase = frases[Math.floor(Math.random() * frases.length)];
  hablarComoBaymax(frase);
}

// ===== CHATBOT =====
async function enviarMensajeChat() {
  const input = document.getElementById('chat-input');
  const mensajesDiv = document.getElementById('chat-messages');
  const userMsg = input.value.trim();
  if (!userMsg) return;

  mensajesDiv.innerHTML += `<div><b>Tú:</b> ${userMsg}</div>`;
  input.value = "";

  try {
    const respuesta = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer TU_API_KEY_AQUI"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: userMsg }]
      })
    });

    const data = await respuesta.json();
    const botMsg = data.choices?.[0]?.message?.content || "Error obteniendo respuesta.";

    mensajesDiv.innerHTML += `<div><b>Baymax:</b> ${botMsg}</div>`;
    mensajesDiv.scrollTop = mensajesDiv.scrollHeight;

    hablarComoBaymax(botMsg);
  } catch (error) {
    console.error("Error en el chatbot:", error);
    mensajesDiv.innerHTML += `<div><b>Baymax:</b> Error al conectar con el servidor.</div>`;
  }
}
