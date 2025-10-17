var gk_isXlsx = false;
var gk_xlsxFileLookup = {};
var gk_fileData = {};
function filledCell(cell) {
  return cell !== '' && cell != null;
}
function loadFileData(filename) {
  if (gk_isXlsx && gk_xlsxFileLookup[filename]) {
    try {
      var workbook = XLSX.read(gk_fileData[filename], { type: 'base64' });
      var firstSheetName = workbook.SheetNames[0];
      var worksheet = workbook.Sheets[firstSheetName];
      var jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: '' });
      var filteredData = jsonData.filter(row => row.some(filledCell));
      var headerRowIndex = filteredData.findIndex((row, index) =>
        row.filter(filledCell).length >= filteredData[index + 1]?.filter(filledCell).length
      );
      if (headerRowIndex === -1 || headerRowIndex > 25) {
        headerRowIndex = 0;
      }
      var csv = XLSX.utils.aoa_to_sheet(filteredData.slice(headerRowIndex));
      csv = XLSX.utils.sheet_to_csv(csv, { header: 1 });
      return csv;
    } catch (e) {
      console.error(e);
      return "";
    }
  }
  return gk_fileData[filename] || "";
}

var TMDB_API_KEY = "38e497c6c1a043d1341416e80915669f";
var USUARIO = "lzrdrz10";
var REPO = "sv";

var seleccionado = {};

// Function to get token from localStorage
function getGithubToken() {
  return localStorage.getItem('githubToken') || '';
}

// Save token to localStorage
document.getElementById('saveTokenBtn').addEventListener('click', function() {
  const tokenInput = document.getElementById('githubToken').value.trim();
  if (tokenInput) {
    localStorage.setItem('githubToken', tokenInput);
    alert('Token guardado con éxito');
    document.getElementById('githubToken').value = ''; // Clear input after saving
  } else {
    alert('Por favor, ingresa un token válido');
  }
});

// Clear token from localStorage
document.getElementById('clearTokenBtn').addEventListener('click', function() {
  localStorage.removeItem('githubToken');
  alert('Token borrado con éxito');
  document.getElementById('githubToken').value = ''; // Clear input
});

// Initialize token input with saved token (if any)
document.getElementById('githubToken').value = getGithubToken();

// Función para quitar tildes (solo para nombres de carpetas)
function quitarTildes(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Codificar a base64 en UTF-8
function toBase64UTF8(str) {
  try {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return btoa(String.fromCharCode(...bytes));
  } catch (e) {
    // Fallback para entornos sin TextEncoder
    return btoa(unescape(encodeURIComponent(str)));
  }
}

// Corregir mojibake (versión mejorada para múltiples encodings)
function fixMojibake(text, maxLevels = 5) {
  let result = text;
  for (let level = 0; level < maxLevels; level++) {
    try {
      // Intenta decodificar como Windows-1252 y convertir a UTF-8
      const bytes = new Uint8Array(result.length);
      for (let i = 0; i < result.length; i++) {
        bytes[i] = result.charCodeAt(i) & 0xff;
      }
      const decoded = new TextDecoder('windows-1252').decode(bytes);
      if (decoded === result) break; // No más cambios, salir
      result = decoded;
    } catch (e) {
      break;
    }
  }
  // Intenta una última corrección desde UTF-8 mal interpretado
  try {
    const bytes = new Uint8Array(result.length);
    for (let i = 0; i < result.length; i++) {
      bytes[i] = result.charCodeAt(i) & 0xff;
    }
    result = new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    // Ignorar errores finales
  }
  return result;
}

// Buscador TMDB
document.getElementById("buscador").addEventListener("input", function() {
  var q = this.value.trim();
  if (!q) {
    document.getElementById("resultados").innerHTML = "";
    return;
  }
  fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=es-MX&query=${encodeURIComponent(q)}`)
    .then(r => r.json()).then(d => {
      var html = "";
      (d.results || []).forEach(p => {
        if (p.media_type === "movie" || p.media_type === "tv") {
          let poster = p.poster_path ? "https://image.tmdb.org/t/p/w500" + p.poster_path : "";
          let titulo = p.title || p.name;
          let fecha = p.release_date || p.first_air_date || "";
          let year = fecha ? fecha.split("-")[0] : "Sin año";

          html += `<div class="item" onclick="abrirModal(${p.id},'${p.media_type}')">
                     <img src="${poster}">
                     <div>${titulo} <span style="color:#00ff7f">(${year})</span></div>
                   </div>`;
        }
      });
      document.getElementById("resultados").innerHTML = html;
    });
});

// Mostrar/ocultar secciones del modal según tipo
document.getElementById("tipo-contenido").addEventListener("change", function() {
  var tipo = this.value;
  document.getElementById("modal-pelicula").style.display = tipo === "movie" ? "block" : "none";
  document.getElementById("modal-serie").style.display = tipo === "tv" ? "block" : "none";
});

// Abrir modal
function abrirModal(id, tipo) {
  fetch(`https://api.themoviedb.org/3/${tipo}/${id}?api_key=${TMDB_API_KEY}&language=es-MX&append_to_response=credits${tipo === 'tv' ? ',seasons' : ''}`)
    .then(r => r.json()).then(p => {
      seleccionado = {
        id,
        tipo,
        titulo: p.title || p.name,
        poster: "https://image.tmdb.org/t/p/original" + p.poster_path,
        backdrop: "https://image.tmdb.org/t/p/original" + p.backdrop_path,
        year: (p.release_date || p.first_air_date || "").split("-")[0],
        sinopsis: p.overview || "",
        duracion: p.runtime || "",
        generos: (p.genres || []).map(g => g.name),
        pais: (p.production_countries && p.production_countries[0]) ? p.production_countries[0].name : "Desconocido",
        rating: p.vote_average || 0
      };
      if (tipo === "tv") {
        seleccionado.temporadas = p.seasons
          .filter(s => s.season_number >= 1)
          .map(s => ({
            numero: s.season_number,
            episodios: Array(s.episode_count).fill().map((_, i) => ({ numero: i + 1, url: "" }))
          }));
        actualizarModalTemporadas(seleccionado.temporadas);
      }
      document.getElementById("modal-titulo").innerText = seleccionado.titulo;
      document.getElementById("videoLink").value = "";
      document.getElementById("downloadLink").value = "";
      document.getElementById("modal").style.display = "flex";
      document.getElementById("modal-pelicula").style.display = tipo === "movie" ? "block" : "none";
      document.getElementById("modal-serie").style.display = tipo === "tv" ? "block" : "none";
    });
}

// Actualizar formulario de temporadas
function actualizarModalTemporadas(temporadas) {
  let contenedor = document.getElementById("temporadas-contenedor");
  contenedor.innerHTML = "";
  temporadas.forEach(temp => {
    let div = document.createElement("div");
    div.innerHTML = `<h4 class="text-[#00ff7f] mt-4">Temporada ${temp.numero}</h4>`;
    temp.episodios.forEach(ep => {
      div.innerHTML += `
        <label class="block text-sm mt-2">Episodio ${ep.numero}:</label>
        <input type="text" data-temporada="${temp.numero}" data-episodio="${ep.numero}" placeholder="URL del episodio" class="w-full p-2 mt-1 bg-[#111] text-white border-[#00ff7f] rounded">
      `;
    });
    contenedor.appendChild(div);
  });
}

// Cerrar modal
function cerrarModal() {
  document.getElementById("modal").style.display = "none";
}

// Plantilla para series
function plantillaSerie(o) {
  let videosPorCapitulo = {};
  o.temporadas.forEach(temp => {
    videosPorCapitulo[temp.numero] = {};
    temp.episodios.forEach(ep => {
      videosPorCapitulo[temp.numero][ep.numero] = ep.url;
    });
  });
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${o.titulo}</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css" rel="stylesheet" />
<style>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
body, html { margin: 0; padding: 0; height: 100%; }
body::before {
  content: "";
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background-image: url('${o.backdrop}');
  background-size: cover;
  background-position: center;
  z-index: -2;
}
body::after {
  content: "";
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.75);
  z-index: -1;
}
#iframe-principal { width: 100%; height: 220px; border: none; background: black; }
#contenedor-video { position: fixed; top: 0; left: 0; width: 100%; z-index: 10; }
.capitulo-seleccionado { background-color: #FF0000 !important; color: #fff !important; font-weight: bold; border-bottom: none !important; }
</style>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-PC9JETB0VP"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-PC9JETB0VP');
</script>
<script disable-devtool-auto src='https://cdn.jsdelivr.net/npm/disable-devtool@latest'></script>
</head>
<body class="text-white font-sans leading-relaxed">
<div id="contenedor-video" class="relative">
  <iframe id="iframe-principal" allow="fullscreen" allowfullscreen></iframe>
  <a href="../index.html" aria-label="Volver" class="absolute top-3 left-3 text-white text-2xl z-20">
    <i class="fas fa-arrow-left"></i>
  </a>
  <div class="absolute top-0 left-0 w-full h-full z-10" style="pointer-events: none;"></div>
</div>
<div class="px-4 pt-60 pb-4 space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-xl sm:text-2xl font-bold">${o.titulo} T<span id="temp-titulo">1</span></h1>
  </div>
  <div class="flex flex-wrap items-center gap-3 text-sm text-gray-400">
    <span><strong class="text-[#FF7F00]">${o.rating.toFixed(1)}</strong> / 10</span>
    <span class="text-white">•</span>
    <span>${o.generos.join(',')}</span>
    <span class="text-white">•</span>
    <span>${o.year}</span>
  </div>
  <div class="flex items-center gap-3">
    <label for="temporada" class="text-sm text-gray-300">Temporada:</label>
    <select id="temporada" class="bg-[#1f1f1f] text-white px-3 py-1 rounded text-sm">
      ${o.temporadas.map(t => `<option value="${t.numero}">Temporada ${t.numero}</option>`).join('')}
    </select>
  </div>
  <div class="flex space-x-2 overflow-x-auto scrollbar-hide pb-1" id="lista-capitulos"></div>
  <div class="bg-[#1e1e1e] rounded-lg p-4 text-sm text-gray-300 leading-relaxed">
    <p><span class="font-semibold text-white">Sinopsis:</span> ${o.sinopsis}</p>
  </div>
</div>
<script>
(function(_0x1f4b3a,_0x2e5c1d){var _0x4c3e2b=function(_0x5a3f1c){while(--_0x5a3f1c){_0x1f4b3a['push'](_0x1f4b3a['shift']());}};var _0x3b2f4e=function(){var _0x1a3e5f={'data':function(_0x4e2c1b,_0x3f5a2d){return _0x4e2c1b!==_0x3f5a2d;},'action':function(){return'atob';},'value':function(){return'VXNlckx6UGxheQ==';},'store':function(){return'localStorage';},'redirect':function(){return'https://descargar.lzplayhd.online/';},'message':function(){return'Acceso no permitido. Descarga la aplicacion oficial';},'isSafari':function(){return /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);}};return _0x1a3e5f;}();_0x4c3e2b(0x1f4);var _0x5e3d2a=_0x3b2f4e;document['addEventListener']('DOMContentLoaded',function(){if(!_0x5e3d2a['isSafari']()){var _0x2d4f1c=_0x5e3d2a['store']();var _0x4b3e2f=window[_0x2d4f1c]['getItem']('accessToken');if(!_0x4b3e2f || _0x5e3d2a['data'](_0x4b3e2f,_0x5e3d2a['action']()(_0x5e3d2a['value']()))){alert(_0x5e3d2a['message']());window['location']['href']=_0x5e3d2a['redirect']();}window[_0x2d4f1c]['removeItem']('accessToken');}});})(['push','shift'],0x1f4);

var serieId = "${o.id}";
var temporadaSelect = document.getElementById('temporada');
var listaCapitulos = document.getElementById('lista-capitulos');
var tempTitulo = document.getElementById('temp-titulo');
var iframePrincipal = document.getElementById('iframe-principal');

var serieActual = {
  id: serieId,
  titulo: "${o.titulo}",
  temporada: temporadaSelect.value,
  poster: "${o.poster}"
};

var videosPorCapitulo = ${JSON.stringify(videosPorCapitulo)};

function guardarTemporada(temporada) {
  localStorage.setItem("temporadaSeleccionada_" + serieId, temporada);
}

function cargarTemporadaGuardada() {
  var temp = localStorage.getItem("temporadaSeleccionada_" + serieId);
  return temp ? temp : "1";
}

function guardarCapitulo(capitulo) {
  var key = "ultimoCapituloVisto_" + serieId + "_T" + serieActual.temporada;
  localStorage.setItem(key, capitulo);
}

function cargarCapituloGuardado() {
  var key = "ultimoCapituloVisto_" + serieId + "_T" + serieActual.temporada;
  var capituloGuardado = localStorage.getItem(key);
  var botones = listaCapitulos.getElementsByClassName('capitulo-btn');
  var encontrado = false;

  for (var i = 0; i < botones.length; i++) {
    botones[i].className = botones[i].className.replace(' capitulo-seleccionado', '');
    if (botones[i].getAttribute('data-capitulo') === capituloGuardado) {
      botones[i].className += ' capitulo-seleccionado';
      botones[i].scrollIntoView({ behavior: 'smooth', inline: 'center' });
      cambiarVideo(capituloGuardado);
      encontrado = true;
    }
  }
  if (!encontrado) {
    cambiarVideo("1");
  }
}

function cambiarVideo(capitulo) {
  var temp = serieActual.temporada;
  var url = videosPorCapitulo[temp] && videosPorCapitulo[temp][capitulo];
  if (url) {
    iframePrincipal.src = url;
    guardarCapitulo(capitulo);
  }
}

function generarCapitulos(temporada) {
  listaCapitulos.innerHTML = '';
  var capitulosObj = videosPorCapitulo[temporada] || {};
  var total = Object.keys(capitulosObj).length;

  for (var i = 1; i <= total; i++) {
    var btn = document.createElement('button');
    btn.className = 'capitulo-btn px-4 py-2 rounded bg-[#2a2a2a] text-white';
    btn.setAttribute('data-capitulo', i.toString());
    btn.textContent = i;
    listaCapitulos.appendChild(btn);
  }
  agregarEventosCapitulos();
  cargarCapituloGuardado();
}

function agregarEventosCapitulos() {
  var botones = listaCapitulos.getElementsByClassName('capitulo-btn');
  for (var i = 0; i < botones.length; i++) {
    (function(index) {
      botones[index].onclick = function() {
        for (var j = 0; j < botones.length; j++) {
          botones[j].className = botones[j].className.replace(' capitulo-seleccionado', '');
        }
        if (botones[index].className.indexOf('capitulo-seleccionado') === -1) {
          botones[index].className += ' capitulo-seleccionado';
        }
        botones[index].scrollIntoView({ behavior: 'smooth', inline: 'center' });
        cambiarVideo(botones[index].getAttribute('data-capitulo'));
      };
    })(i);
  }
}

temporadaSelect.onchange = function() {
  var temp = temporadaSelect.value;
  serieActual.temporada = temp;
  tempTitulo.textContent = temp;
  guardarTemporada(temp);
  generarCapitulos(temp);
};

window.onload = function() {
  var tempGuardada = cargarTemporadaGuardada();
  temporadaSelect.value = tempGuardada;
  serieActual.temporada = tempGuardada;
  tempTitulo.textContent = tempGuardada;
  generarCapitulos(tempGuardada);
};

</script>
</body>
</html>`;
}

// Plantilla para películas
function plantilla(o, video, videodescargador) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>${o.titulo}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css" rel="stylesheet"/>
    <style>
        html, body {
            height: 100%;
            margin: 0;
            padding: 0;
        }
        body {
            background: url('${o.backdrop}') no-repeat center center fixed;
            background-size: cover;
        }
        .overlay {
            min-height: 100vh;
            background-color: rgba(18, 18, 18, 0.85);
            display: flex;
            flex-direction: column;
        }
    </style>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-PC9JETB0VP"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag() {
            dataLayer.push(arguments);
        }
        gtag('js', new Date());
        gtag('config', 'G-PC9JETB0VP');
        if (!navigator.onLine) {
            window.location.href = "sin-conexion.html";
        }
    </script><!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-PC9JETB0VP"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-PC9JETB0VP');
</script>
    <script disable-devtool-auto src='https://cdn.jsdelivr.net/npm/disable-devtool@latest'></script>
</head>
<body class="text-white font-sans">
    <div class="overlay min-h-screen">
        <div class="max-w-4xl mx-auto p-4 pb-24">
            <div class="rounded-md overflow-hidden relative aspect-video bg-black">
                <iframe class="w-full h-full" src="${video}" data-alternativo="${videodescargador}" title="" frameborder="0" allowfullscreen></iframe>
            </div>
            <div class="flex space-x-4 mt-4 bg-[#1a1a1a] p-4 rounded-md items-center">
                <div class="flex items-center justify-center w-[110px] h-[160px] flex-shrink-0">
                    <img alt="${o.titulo}" class="rounded-lg w-full h-full object-cover" src="${o.poster}" />
                </div>
                <div class="flex-1">
                    <h3 class="text-xl font-semibold">${o.titulo}</h3>
                    <p class="text-gray-300 italic text-sm">Publicado por: LeoshinFilms</p>
                    <div class="flex flex-wrap items-center space-x-2 text-xs text-gray-400 mt-1">
                        <span>${o.pais}</span>
                        <span>Duración: ${o.duracion} Minutos</span>
                        <span>Año: ${o.year}</span>
                    </div>
                    <div class="flex items-center mt-3 space-x-3">
                        <div id="rating-value" class="bg-[#2a2a2a] rounded-md px-3 py-1 text-lg font-semibold text-white">${o.rating.toFixed(1)}</div>
                        <div id="star-container" class="flex space-x-1 text-yellow-400 text-lg"></div>
                    </div>
                    <div class="flex space-x-6 text-xs text-gray-400 mt-3">
                        <span>${o.generos.join(', ')}</span>
                    </div>
                </div>
            </div>
            <div class="flex flex-wrap space-x-2 mt-4 relative">
                <button id="info-btn" class="bg-red-600 text-white px-4 py-2 rounded text-sm font-semibold flex items-center space-x-1" type="button">
                    <i class="fas fa-info-circle"></i>
                    <span>Info</span>
                </button>
                <button id="cast-btn" class="bg-gray-700 text-gray-400 px-4 py-2 rounded text-sm font-semibold" title="Transmitir Pantalla">
                    <i class="fas fa-tv"></i>
                </button>
                <button id="download-btn" class="bg-gray-700 text-gray-400 px-4 py-2 rounded text-sm font-semibold" title="Descargar">
                    <i class="fas fa-download"></i>
                </button>
            </div>
            <div id="sinopsis" class="mt-4 bg-[#1a1a1a] p-4 rounded-md">
                <h4 class="text-white text-lg font-semibold mb-2">Sinopsis</h4>
                <p class="text-gray-300 text-sm leading-relaxed">${o.sinopsis}</p>
            </div>
        </div>
    </div>
    <script>
  var rating = ${o.rating.toFixed(1)};
  var starContainer = document.getElementById('star-container');
  var fullStars = Math.floor(rating / 2);
  var halfStar = rating % 2 >= 1;
  for (var i = 0; i < 5; i++) {
    var star = document.createElement('i');
    if (i < fullStars) star.className = 'fas fa-star text-yellow-400';
    else if (i === fullStars && halfStar) star.className = 'fas fa-star-half-alt text-yellow-400';
    else star.className = 'fas fa-star text-gray-400';
    starContainer.appendChild(star);
  }
  document.getElementById('rating-value').innerText = rating.toFixed(1);

  var infoBtn = document.getElementById('info-btn');
  var sinopsis = document.getElementById('sinopsis');
  var castBtn = document.getElementById('cast-btn');
  var downloadBtn = document.getElementById('download-btn');
  var iframe = document.querySelector('iframe');
  var altURL = iframe.getAttribute('data-alternativo') || iframe.src;
  var cleanAltURL = altURL.replace('https://', '').replace('http://', '');

  infoBtn.addEventListener('click', function () {
    sinopsis.scrollIntoView({ behavior: 'smooth' });
  });

  castBtn.addEventListener('click', function () {
    window.open('intent://' + cleanAltURL + '#Intent;package=com.instantbits.cast.webvideo;scheme=https;end', '_blank');
  });

  downloadBtn.addEventListener('click', function (e) {
    e.preventDefault();
    var plusIntent = 'intent://' + cleanAltURL + '#Intent;package=idm.internet.download.manager.plus;scheme=https;end';
    var normalIntent = 'intent://' + cleanAltURL + '#Intent;package=idm.internet.download.manager;scheme=https;end';

    // Intentar abrir 1DM+ primero
    window.location.href = plusIntent;

    // Si falla, intentar con 1DM normal (después de 1 segundo)
    setTimeout(function () {
      window.location.href = normalIntent;
    }, 1000);
  });
</script>
    <nav class="fixed bottom-0 left-0 w-full bg-[#1E1E1E] flex justify-around items-center py-3 rounded-b-3xl text-white text-xs font-semibold z-50">
        <a href="../index.html" class="flex flex-col items-center space-y-1">
            <i class="fas fa-arrow-left text-xl"></i>
            <span>Regresar</span>
        </a>
        <a href="../Categorias/movie/index.html" class="flex flex-col items-center space-y-1">
            <i class="fas fa-film text-xl"></i>
            <span>Movies</span>
        </a>
        <a href="../Categorias/serie/index.html" class="flex flex-col items-center space-y-1">
            <i class="fas fa-tv text-xl"></i>
            <span>Series</span>
        </a>
        <a href="../SEARCH/index.html" class="flex flex-col items-center space-y-1">
            <i class="fas fa-search text-xl"></i>
            <span>Buscar</span>
        </a>
    </nav>
</body>
</html>

`;
}

// Crear archivo en GitHub
async function crearArchivoGit(ruta, contenido, sha = null) {
  let body = {
    message: `Crear/Actualizar ${ruta}`,
    content: toBase64UTF8(contenido),
    branch: "main"
  };
  if (sha) body.sha = sha;
  let resp = await fetch(`https://api.github.com/repos/${USUARIO}/${REPO}/contents/${ruta}`, {
    method: "PUT",
    headers: { "Authorization": "token " + GITHUB_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`Error al crear ${ruta}: ${resp.statusText}`);
}

// Publicar contenido
document.getElementById("publicarBtn").addEventListener("click", async function() {
  var animacion = document.getElementById("animacionPublicar");
  var barra = document.getElementById("progreso");
  var mensaje = document.getElementById("mensaje");
  animacion.style.display = "block";
  barra.style.width = "0%";
  // Corregir texto del mensaje para evitar mojibake en el UI
  mensaje.innerText = fixMojibake(`Publicando ${seleccionado.tipo === "movie" ? "película" : "serie"}... 0%`);

  function actualizarProgreso(p) {
    barra.style.width = p + "%";
    mensaje.innerText = fixMojibake(`Publicando ${seleccionado.tipo === "movie" ? "película" : "serie"}... ${p}%`);
  }

  try {
    let nombreArchivo, html;
    let categorias = [...seleccionado.generos, seleccionado.tipo === "movie" ? "Movie" : "Serie"];
    let plataforma = document.getElementById("platform").value;
    let plataformaText = document.getElementById("platform").options[document.getElementById("platform").selectedIndex].text;
    let tienePlataforma = plataforma && plataforma !== "Sin Plataforma";

    if (seleccionado.tipo === "movie") {
      let video = document.getElementById("videoLink").value;
      let videodescargador = document.getElementById("downloadLink").value;
      html = plantilla(seleccionado, video, videodescargador);
      let lista = await fetch(`https://api.github.com/repos/${USUARIO}/${REPO}/contents/Peliculas`, {
        headers: { "Authorization": "token " + GITHUB_TOKEN }
      }).then(r => r.json());
      let num = (lista.filter(f => f.name.includes("movie")).length) + 1;
      nombreArchivo = `movie${num}.html`;
      await crearArchivoGit(`Peliculas/${nombreArchivo}`, html);
    } else {
      let inputs = document.querySelectorAll("#temporadas-contenedor input");
      inputs.forEach(input => {
        let temp = input.getAttribute("data-temporada");
        let ep = input.getAttribute("data-episodio");
        let url = input.value.trim();
        if (url) {
          let temporada = seleccionado.temporadas.find(t => t.numero == temp);
          let episodio = temporada.episodios.find(e => e.numero == ep);
          episodio.url = url;
        }
      });
      html = plantillaSerie(seleccionado);
      let lista = await fetch(`https://api.github.com/repos/${USUARIO}/${REPO}/contents/Series`, {
        headers: { "Authorization": "token " + GITHUB_TOKEN }
      }).then(r => r.json());
      let num = (lista.filter(f => f.name.includes("serie")).length) + 1;
      nombreArchivo = `serie${num}.html`;
      await crearArchivoGit(`Series/${nombreArchivo}`, html);
    }

    // Calcular progreso para actualizaciones
    actualizarProgreso(50);
    let itemsToUpdate = categorias.length + (tienePlataforma ? 1 : 0);
    let perItem = itemsToUpdate > 0 ? 50 / itemsToUpdate : 0;
    let currentItem = 0;

    // Actualizar índices de categorías
    for (let i = 0; i < categorias.length; i++) {
      let genero = categorias[i];
      let generoCarpeta = quitarTildes(genero).replace(/\s+/g, "").toLowerCase();
      let rutaIndex = `Categorias/${generoCarpeta}/index.html`;

      let contenidoIndex = "";
      let shaIndex = null;
      try {
        let indexResp = await fetch(`https://api.github.com/repos/${USUARIO}/${REPO}/contents/${rutaIndex}`, {
          headers: { "Authorization": "token " + GITHUB_TOKEN }
        });
        if (indexResp.ok) {
          let dataJSON = await indexResp.json();
          contenidoIndex = atob(dataJSON.content.replace(/\n/g, ""));
          shaIndex = dataJSON.sha;
          contenidoIndex = fixMojibake(contenidoIndex);
        }
      } catch (e) {
        contenidoIndex = `<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${genero}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css" />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    body { font-family: "Poppins", sans-serif; }
  </style>
  <script disable-devtool-auto src='https://cdn.jsdelivr.net/npm/disable-devtool@latest'></script>
</head>
<body class="bg-[#04143B] text-white min-h-screen">
  <header class="fixed top-0 left-0 w-full z-50 bg-[#04143B] flex flex-col md:flex-row items-center justify-between px-4 py-3 max-w-[1280px] mx-auto">
    <div class="flex items-center space-x-4 w-full md:w-auto justify-between">
      <div class="flex flex-row items-center space-x-3 mb-6">
        <button onclick="history.back()" class="bg-[#0D1B4C] rounded-full px-4 py-1.5 text-sm font-semibold text-[#4A7FFF] flex items-center space-x-1 focus:outline-none focus:ring-2 focus:ring-[#4A7FFF]">
          <i class="fas fa-arrow-left"></i><span>Atras</span>
        </button>
        <h1 class="text-2xl font-extrabold text-[#4A7FFF] select-none">${genero}</h1>
      </div>
      <a href="../../../SEARCH/" id="btnBuscar" aria-label="Buscar" class="md:hidden flex items-center justify-center w-10 h-10 rounded-full border-2 border-white shadow-md">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </a>
    </div>
    <nav class="hidden md:flex items-center space-x-6 text-sm font-semibold text-white/90 mt-2 md:mt-0">
      <a href="../../../" class="flex items-center space-x-1 text-white hover:text-[#4A7FFF]">
        <i class="fas fa-home"></i><span>Inicio</span>
      </a>
      <a href="../../movie" class="hover:text-[#4A7FFF]">Películas</a>
      <a href="../../serie" class="hover:text-[#4A7FFF]">Series</a>
    </nav>
    <a href="../../../SEARCH/index.html" id="btnBuscarDesktop" aria-label="Buscar" class="hidden md:flex items-center justify-center w-12 h-12 rounded-full border-2 border-white shadow-md ml-4">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    </a>
</header>
<main class="max-w-[1280px] mx-auto px-4 mt-24">
  <section class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
    <!--PEGAR CONTENIDO AQUI ABAJO-->
  </section>
</main>
</body>
</html>`;
      }

      let insertar = `<!-- ${quitarTildes(seleccionado.titulo)} -->
<article class="relative rounded-lg overflow-hidden cursor-pointer select-none">
  <a href="../../${seleccionado.tipo === "movie" ? "Peliculas" : "Series"}/${nombreArchivo}">
    <img src="${seleccionado.poster}" alt="${seleccionado.titulo}" class="w-full h-auto rounded-lg object-cover transition-transform duration-300 hover:scale-105"/>
    <div class="absolute top-2 right-2 bg-white/90 text-black text-xs font-semibold rounded-full px-2 py-0.5">
      ${seleccionado.tipo === "movie" ? "Movie" : "Serie"}
    </div>
  </a>
  <div class="mt-2 font-semibold text-sm leading-tight truncate">${seleccionado.titulo}</div>
  <div class="text-xs text-white/70">${seleccionado.year}</div>
</article>`;

      let regex = /(<!--\s*PEGAR CONTENIDO AQUI ABAJO\s*-->)/i;
      if (regex.test(contenidoIndex)) {
        contenidoIndex = contenidoIndex.replace(regex, match => `${match}${insertar}`);
      } else {
        let sectionEnd = contenidoIndex.indexOf("</section>");
        if (sectionEnd !== -1) {
          contenidoIndex = contenidoIndex.slice(0, sectionEnd) + insertar + contenidoIndex.slice(sectionEnd);
        } else {
          contenidoIndex += insertar;
        }
      }

      await crearArchivoGit(rutaIndex, contenidoIndex, shaIndex);
      currentItem++;
      actualizarProgreso(50 + Math.round(perItem * currentItem));
    }

    // Actualizar índice de plataforma si se seleccionó una
    if (tienePlataforma) {
      let genero = plataformaText;
      let generoCarpeta = quitarTildes(plataforma).replace(/\s+/g, "").toLowerCase();
      let rutaIndex = `Plataforma/${generoCarpeta}/index.html`;

      let contenidoIndex = "";
      let shaIndex = null;
      try {
        let indexResp = await fetch(`https://api.github.com/repos/${USUARIO}/${REPO}/contents/${rutaIndex}`, {
          headers: { "Authorization": "token " + GITHUB_TOKEN }
        });
        if (indexResp.ok) {
          let dataJSON = await indexResp.json();
          contenidoIndex = atob(dataJSON.content.replace(/\n/g, ""));
          shaIndex = dataJSON.sha;
          contenidoIndex = fixMojibake(contenidoIndex);
        }
      } catch (e) {
        contenidoIndex = `<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${genero}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css" />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    body { font-family: "Poppins", sans-serif; }
  </style>
  <script disable-devtool-auto src='https://cdn.jsdelivr.net/npm/disable-devtool@latest'></script>
</head>
<body class="bg-[#04143B] text-white min-h-screen">
  <header class="fixed top-0 left-0 w-full z-50 bg-[#04143B] flex flex-col md:flex-row items-center justify-between px-4 py-3 max-w-[1280px] mx-auto">
    <div class="flex items-center space-x-4 w-full md:w-auto justify-between">
      <div class="flex flex-row items-center space-x-3 mb-6">
        <button onclick="history.back()" class="bg-[#0D1B4C] rounded-full px-4 py-1.5 text-sm font-semibold text-[#4A7FFF] flex items-center space-x-1 focus:outline-none focus:ring-2 focus:ring-[#4A7FFF]">
          <i class="fas fa-arrow-left"></i><span>Atras</span>
        </button>
        <h1 class="text-2xl font-extrabold text-[#4A7FFF] select-none">${genero}</h1>
      </div>
      <a href="../../SEARCH/" id="btnBuscar" aria-label="Buscar" class="md:hidden flex items-center justify-center w-10 h-10 rounded-full border-2 border-white shadow-md">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </a>
    </div>
    <nav class="hidden md:flex items-center space-x-6 text-sm font-semibold text-white/90 mt-2 md:mt-0">
      <a href="../../" class="flex items-center space-x-1 text-white hover:text-[#4A7FFF]">
        <i class="fas fa-home"></i><span>Inicio</span>
      </a>
      <a href="../movie" class="hover:text-[#4A7FFF]">Películas</a>
      <a href="../serie" class="hover:text-[#4A7FFF]">Series</a>
    </nav>
    <a href="../../SEARCH/index.html" id="btnBuscarDesktop" aria-label="Buscar" class="hidden md:flex items-center justify-center w-12 h-12 rounded-full border-2 border-white shadow-md ml-4">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    </a>
</header>
<main class="max-w-[1280px] mx-auto px-4 mt-24">
  <section class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
    <!--PEGAR CONTENIDO AQUI ABAJO-->
  </section>
</main>
</body>
</html>`;
      }

      let insertar = `<!-- ${quitarTildes(seleccionado.titulo)} -->
<article class="relative rounded-lg overflow-hidden cursor-pointer select-none">
  <a href="../../${seleccionado.tipo === "movie" ? "Peliculas" : "Series"}/${nombreArchivo}">
    <img src="${seleccionado.poster}" alt="poster" class="w-full h-auto rounded-lg object-cover transition-transform duration-300 hover:scale-105" loading="lazy"/>
    <div class="absolute top-2 right-2 bg-white/90 text-black text-xs font-semibold rounded-full px-2 py-0.5">
      ${seleccionado.tipo === "movie" ? "Movie" : "Serie"}
    </div>
  </a>
  <div class="mt-2 font-semibold text-sm leading-tight truncate">${seleccionado.titulo}</div>
  <div class="text-xs text-white/70">${seleccionado.year}</div>
</article>`;

      let regex = /(<!--\s*PEGAR CONTENIDO AQUI ABAJO\s*-->)/i;
      if (regex.test(contenidoIndex)) {
        contenidoIndex = contenidoIndex.replace(regex, match => `${match}${insertar}`);
      } else {
        let sectionEnd = contenidoIndex.indexOf("</section>");
        if (sectionEnd !== -1) {
          contenidoIndex = contenidoIndex.slice(0, sectionEnd) + insertar + contenidoIndex.slice(sectionEnd);
        } else {
          contenidoIndex += insertar;
        }
      }

      await crearArchivoGit(rutaIndex, contenidoIndex, shaIndex);
      currentItem++;
      actualizarProgreso(50 + Math.round(perItem * currentItem));
    }

    // Actualizar SEARCH/index.html
    try {
      let rutaSearch = `HOME/Buscador2.html`;
      let contenidoSearch = "";
      let shaSearch = null;

      let searchResp = await fetch(`https://api.github.com/repos/${USUARIO}/${REPO}/contents/${rutaSearch}`, {
        headers: { "Authorization": "token " + GITHUB_TOKEN }
      });
      if (searchResp.ok) {
        let dataJSON = await searchResp.json();
        contenidoSearch = atob(dataJSON.content.replace(/\n/g, ""));
        shaSearch = dataJSON.sha;
        contenidoSearch = fixMojibake(contenidoSearch);
      } else {
        throw new Error("No se encontró HOME/Buscador2.html");
      }

      let liInsert = `<!-- ${quitarTildes(seleccionado.titulo)} -->
<li>
  <a href="../${seleccionado.tipo === "movie" ? "Peliculas" : "Series"}/${nombreArchivo}" tabindex="0" class="block outline-none focus:ring-2 ring-yellow-400 rounded">
   <img 
  src="${seleccionado.poster}" alt="poster" class="w-full aspect-[2/3] rounded-lg object-cover mb-2 sm:mb-0" loading="lazy"/>
    <span class="hidden">${seleccionado.titulo} ${seleccionado.year}</span>
    <span class="hidden">${seleccionado.sinopsis}</span>
  </a>
</li>
<!--FIN-->`;

      let regexSearch = /<!--\s*ABAJO AGREGAR NUEVO CONTENIDO\s*-->/i;
      if (regexSearch.test(contenidoSearch)) {
        contenidoSearch = contenidoSearch.replace(regexSearch, match => `${match}${liInsert}`);
      } else {
        let ulEnd = contenidoSearch.indexOf("</ul>");
        if (ulEnd !== -1) {
          contenidoSearch = contenidoSearch.slice(0, ulEnd) + liInsert + contenidoSearch.slice(ulEnd);
        } else {
          contenidoSearch += liInsert;
        }
      }

      await crearArchivoGit(rutaSearch, contenidoSearch, shaSearch);
    } catch (err) {
      console.error("Error al actualizar HOME/Buscador2.html:", err);
    }

    actualizarProgreso(100);
    mensaje.innerText = fixMojibake(`¡${seleccionado.tipo === "movie" ? "Película" : "Serie"} publicada con éxito!`);
    setTimeout(() => animacion.style.display = "none", 2000);
  } catch (err) {
    mensaje.innerText = fixMojibake("Error al publicar: " + err.message);
    barra.style.background = "red";
  }
});