/* ==========================================================================
   NARRATIVA - APPLICATION LOGIC (Quiet Luxury SPA)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  
  // --- 1. STATE & CORE VARIABLES ---
  let stories = [];
  let currentTrack = null;
  let isPlaying = false;
  let activePage = "page-stories";
  let lastVolume = 0.8;
  let uploadedFile = null;

  // DOM Elements
  const header = document.getElementById("main-header");
  const pages = document.querySelectorAll(".page");
  const navLinks = document.querySelectorAll(".nav-link");
  const logoLink = document.getElementById("logo-link");

  // Audio Node
  const audio = document.getElementById("global-audio-element");

  // Player DOM
  const player = document.getElementById("global-player");
  const playerCover = document.getElementById("player-track-cover");
  const playerTitle = document.getElementById("player-track-title");
  const playerNarrator = document.getElementById("player-track-narrator");
  const playBtn = document.getElementById("player-btn-toggle");
  const playIcon = document.getElementById("player-play-icon");
  const skipBackwardBtn = document.getElementById("player-btn-backward");
  const skipForwardBtn = document.getElementById("player-btn-forward");
  const timeCurrent = document.getElementById("player-time-current");
  const timeTotal = document.getElementById("player-time-total");

  // Custom Progress Slider
  const progressContainer = document.getElementById("player-progress-container");
  const progressFill = document.getElementById("player-progress-fill");
  const progressHandle = document.getElementById("player-progress-handle");

  // Custom Volume Slider
  const muteBtn = document.getElementById("player-btn-mute");
  const volumeIcon = document.getElementById("player-volume-icon");
  const volumeContainer = document.getElementById("player-volume-container");
  const volumeFill = document.getElementById("player-volume-fill");
  const volumeHandle = document.getElementById("player-volume-handle");

  // Canvas Visualizer
  const canvas = document.getElementById("visualizer-canvas");
  const ctx = canvas.getContext("2d");
  let visualizerAnimationId = null;

  // Reader View Elements
  const bookReaderView = document.getElementById("book-reader-view");
  const textsListWrapper = document.getElementById("texts-list-wrapper");
  const closeReaderBtn = document.getElementById("close-reader-btn");
  const readerGenre = document.getElementById("reader-genre-display");
  const readerTitle = document.getElementById("reader-title-display");
  const readerAuthor = document.getElementById("reader-author-display");
  const readerTime = document.getElementById("reader-time-display");
  const readerAudioBtn = document.getElementById("reader-audio-trigger-btn");
  const readerAudioIcon = document.getElementById("reader-audio-icon");
  const bookTextWrapper = document.getElementById("book-text-wrapper");
  const bookBodyContent = document.getElementById("book-body-content");
  const fontSizeBtns = document.querySelectorAll(".font-size-btn");
  const readerThemeToggle = document.getElementById("reader-theme-toggle");
  const readerThemeIcon = document.getElementById("reader-theme-icon");

  // Admin / Upload Form Elements
  const uploadForm = document.getElementById("upload-story-form");
  const dragZone = document.getElementById("audio-drag-zone");
  const fileInput = document.getElementById("audio-file-input");
  const fileIndicator = document.getElementById("uploaded-file-indicator");
  const fileNameDisplay = document.getElementById("uploaded-file-name");
  const submitBtn = document.getElementById("form-submit-btn");

  // Toasts
  const toast = document.getElementById("toast-notification");
  const toastMsg = document.getElementById("toast-message");


  // --- 2. LOAD STORED DATA ---
  // Load local storage stories if they exist
  const loadStoredStories = () => {
    try {
      const stored = localStorage.getItem("narrativa_stories");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Map over stored and restore sample audio URLs or store variables
        parsed.forEach(story => {
          // If the audio URL is a blob URL from a previous session, it won't work anymore.
          // In that case, we fallback to a sample SoundHelix URL based on their order.
          if (story.audioUrl.startsWith("blob:")) {
            const index = Math.floor(Math.random() * 3) + 1;
            story.audioUrl = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${index}.mp3`;
          }
          stories.push(story);
        });
      }
    } catch (e) {
      console.error("No se pudieron cargar relatos almacenados.", e);
    }
  };
  loadStoredStories();


  // --- 3. PAGE ROUTING & NAVIGATION ---
  const switchPage = (targetPageId) => {
    // Scroll header styling
    if (window.scrollY > 20) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }

    // Hide immersive reader if leaving reading page
    if (targetPageId !== "page-texts") {
      bookReaderView.classList.remove("active");
      textsListWrapper.style.display = "block";
    }

    // Toggle active state in navigation links
    navLinks.forEach(link => {
      if (link.getAttribute("data-target") === targetPageId) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    // Animate pages
    pages.forEach(page => {
      if (page.id === targetPageId) {
        page.classList.add("active");
      } else {
        page.classList.remove("active");
      }
    });

    activePage = targetPageId;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      const target = link.getAttribute("data-target");
      switchPage(target);
    });
  });

  logoLink.addEventListener("click", (e) => {
    e.preventDefault();
    switchPage("page-stories");
  });

  // Header scroll shadow effect
  window.addEventListener("scroll", () => {
    if (window.scrollY > 20) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });


  // --- 4. DATA RENDERING ---
  const formatTime = (secs) => {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Render Cuentos (Audio Gallery)
  const renderStories = () => {
    const grid = document.getElementById("stories-grid-container");
    const countDisplay = document.getElementById("stories-count");
    grid.innerHTML = "";

    const activeStories = stories.filter(s => !s.deleted);
    countDisplay.textContent = `${activeStories.length} ${activeStories.length === 1 ? 'relato disponible' : 'relatos disponibles'}`;

    activeStories.forEach(story => {
      const card = document.createElement("div");
      card.className = "story-card";
      card.innerHTML = `
        <div class="story-card-image-wrapper">
          <img src="${story.cover}" alt="${story.title}" class="story-card-image">
          <button class="card-delete-btn" data-id="${story.id}" title="Eliminar cuento">
            <i data-lucide="trash-2" style="width: 16px; height: 16px; stroke-width: 2;"></i>
          </button>
          <div class="story-card-overlay">
            <button class="card-play-btn" data-id="${story.id}" title="Reproducir cuento">
              <i data-lucide="play" style="fill: currentColor; width: 24px; height: 24px;"></i>
            </button>
          </div>
        </div>
        <div class="story-card-content">
          <span class="story-card-genre">${story.genre}</span>
          <h3 class="story-card-title" data-id="${story.id}">${story.title}</h3>
          <p class="story-card-synopsis">${story.synopsis}</p>
          <div class="story-card-meta">
            <div class="story-card-narrator">
              <i data-lucide="mic" style="width: 14px; height: 14px; stroke-width: 2;"></i>
              <span>${story.narrator}</span>
            </div>
            <div class="story-card-duration">
              <i data-lucide="clock" style="width: 14px; height: 14px; stroke-width: 2;"></i>
              <span>${story.duration}</span>
            </div>
          </div>
        </div>
      `;

      // Event listeners
      card.querySelector(".card-play-btn").addEventListener("click", () => {
        loadAndPlayTrack(story);
      });
      card.querySelector(".story-card-title").addEventListener("click", () => {
        loadAndPlayTrack(story);
      });
      card.querySelector(".card-delete-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        triggerDelete(story);
      });

      grid.appendChild(card);
    });

    lucide.createIcons();
  };

  // Render Escrituras (Texts list)
  const renderTexts = () => {
    const container = document.getElementById("texts-list-container");
    const countDisplay = document.getElementById("texts-count");
    container.innerHTML = "";

    const activeStories = stories.filter(s => !s.deleted);
    countDisplay.textContent = `${activeStories.length} ${activeStories.length === 1 ? 'escrito publicado' : 'escritos publicados'}`;

    activeStories.forEach((story, idx) => {
      const dateString = idx === 0 ? "24 MAY 2026" : idx === 1 ? "18 MAY 2026" : "12 MAY 2026";
      const row = document.createElement("div");
      row.className = "text-row";
      row.innerHTML = `
        <div class="text-row-date">${dateString}</div>
        <div class="text-row-main">
          <h3 data-id="${story.id}">${story.title}</h3>
          <p class="text-row-desc">${story.synopsis}</p>
          <div class="text-row-meta">
            <span>Escrito por <strong>${story.narrator}</strong></span>
            <span>&bull;</span>
            <span>${story.genre}</span>
            <span>&bull;</span>
            <button class="text-row-action" data-id="${story.id}">
              Leer escrito <i data-lucide="arrow-right" style="width: 14px; height: 14px; stroke-width: 2;"></i>
            </button>
            <span>&bull;</span>
            <button class="text-row-delete-btn" data-id="${story.id}" title="Eliminar escrito">
              <i data-lucide="trash-2" style="width: 14px; height: 14px; stroke-width: 2;"></i>
            </button>
          </div>
        </div>
      `;

      // Event Listeners
      row.querySelector("h3").addEventListener("click", () => {
        openReader(story);
      });
      row.querySelector(".text-row-action").addEventListener("click", () => {
        openReader(story);
      });
      row.querySelector(".text-row-delete-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        triggerDelete(story);
      });

      container.appendChild(row);
    });

    lucide.createIcons();
  };


  // --- 5. AUDIO PLAYER BUSINESS LOGIC ---
  const loadAndPlayTrack = (track) => {
    if (!track) return;
    
    // Check if we are loading the same track
    const isSameTrack = currentTrack && currentTrack.id === track.id;
    
    if (isSameTrack) {
      togglePlayback();
      return;
    }

    currentTrack = track;
    audio.src = track.audioUrl;
    
    // Update Floating Player UI info
    playerCover.src = track.cover;
    playerTitle.textContent = track.title;
    playerNarrator.textContent = track.narrator;
    
    // Slide in player
    player.classList.add("active");
    
    // Trigger play
    audio.play()
      .then(() => {
        isPlaying = true;
        updatePlayBtnState();
        playerCover.classList.add("playing");
        startVisualizer();
        showToast(`Escuchando: ${track.title}`);
      })
      .catch(err => {
        console.error("Audio playback error:", err);
        // Simple error warning toast
        showToast("Error de reproducción. Cargando pista alternativa...");
        // If external audio fails (cross-origin or expired blob URL),
        // fallback to standard soundhelix URL
        const randomFallbackIndex = Math.floor(Math.random() * 3) + 1;
        track.audioUrl = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${randomFallbackIndex}.mp3`;
        audio.src = track.audioUrl;
        audio.play().then(() => {
          isPlaying = true;
          updatePlayBtnState();
          playerCover.classList.add("playing");
          startVisualizer();
        });
      });

    // Update read view listening trigger button state if reading active
    updateReaderAudioButtonState();
  };

  const togglePlayback = () => {
    if (!currentTrack) {
      // If nothing is loaded, play the first track in list
      if (stories.length > 0) {
        loadAndPlayTrack(stories[0]);
      }
      return;
    }

    if (isPlaying) {
      audio.pause();
      isPlaying = false;
      playerCover.classList.remove("playing");
      stopVisualizer();
    } else {
      audio.play()
        .then(() => {
          isPlaying = true;
          playerCover.classList.add("playing");
          startVisualizer();
        })
        .catch(err => console.error(err));
    }
    updatePlayBtnState();
    updateReaderAudioButtonState();
  };

  const updatePlayBtnState = () => {
    if (isPlaying) {
      playIcon.setAttribute("data-lucide", "pause");
    } else {
      playIcon.setAttribute("data-lucide", "play");
    }
    lucide.createIcons();
  };

  playBtn.addEventListener("click", togglePlayback);

  // Skip Back / Forward 10s
  skipBackwardBtn.addEventListener("click", () => {
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  });

  skipForwardBtn.addEventListener("click", () => {
    if (audio.duration) {
      audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
    }
  });

  // Track Native Progress Update
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    
    // Update timeline timer text
    timeCurrent.textContent = formatTime(audio.currentTime);
    
    // Update progress bar width %
    const percent = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = `${percent}%`;
    progressHandle.style.left = `${percent}%`;
  });

  audio.addEventListener("loadedmetadata", () => {
    timeTotal.textContent = formatTime(audio.duration);
  });

  audio.addEventListener("ended", () => {
    isPlaying = false;
    playerCover.classList.remove("playing");
    updatePlayBtnState();
    updateReaderAudioButtonState();
    stopVisualizer();
    // Loop track or play next? Let's just reset time to 0
    audio.currentTime = 0;
    progressFill.style.width = "0%";
    progressHandle.style.left = "0%";
  });

  // Progress scrubbing interaction
  const setProgress = (e) => {
    if (!audio.duration) return;
    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    
    audio.currentTime = percentage * audio.duration;
    
    progressFill.style.width = `${percentage * 100}%`;
    progressHandle.style.left = `${percentage * 100}%`;
  };

  let isDraggingProgress = false;
  
  progressContainer.addEventListener("mousedown", (e) => {
    isDraggingProgress = true;
    setProgress(e);
  });

  window.addEventListener("mousemove", (e) => {
    if (isDraggingProgress) setProgress(e);
  });

  window.addEventListener("mouseup", () => {
    isDraggingProgress = false;
  });

  // Volume operations
  const setVolume = (vol) => {
    // Bind volume between 0 and 1
    const boundedVol = Math.max(0, Math.min(1, vol));
    audio.volume = boundedVol;
    
    // Update UI Volume slider
    volumeFill.style.width = `${boundedVol * 100}%`;
    volumeHandle.style.left = `${boundedVol * 100}%`;
    
    // Update Mute Icon based on level
    if (boundedVol === 0) {
      volumeIcon.setAttribute("data-lucide", "volume-x");
    } else if (boundedVol < 0.4) {
      volumeIcon.setAttribute("data-lucide", "volume");
    } else if (boundedVol < 0.7) {
      volumeIcon.setAttribute("data-lucide", "volume-1");
    } else {
      volumeIcon.setAttribute("data-lucide", "volume-2");
    }
    lucide.createIcons();
    
    if (vol > 0) {
      lastVolume = vol;
    }
  };

  // Dragging volume
  let isDraggingVolume = false;
  const handleVolumeChange = (e) => {
    const rect = volumeContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    setVolume(percentage);
  };

  volumeContainer.addEventListener("mousedown", (e) => {
    isDraggingVolume = true;
    handleVolumeChange(e);
  });

  window.addEventListener("mousemove", (e) => {
    if (isDraggingVolume) handleVolumeChange(e);
  });

  window.addEventListener("mouseup", () => {
    isDraggingVolume = false;
  });

  // Mute toggle
  muteBtn.addEventListener("click", () => {
    if (audio.volume > 0) {
      setVolume(0);
    } else {
      setVolume(lastVolume);
    }
  });

  // Set default initial volume
  setVolume(0.8);


  // --- 6. CANVAS WAVE VISUALIZER ---
  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  };
  
  // Call resize initially
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  let phase = 0;
  const drawWave = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    if (!ctx) return;

    // We draw 3 layered sine waves
    const waveCount = 3;
    const colors = [
      "rgba(212, 197, 176, 0.45)", // Accent Sand
      "rgba(163, 146, 116, 0.3)",  // Muted gold
      "rgba(42, 42, 42, 0.15)"     // Charcoal subtle
    ];
    
    // Wave state parameters
    // If not playing, amplitude decays smoothly to 0 (or a very tiny 1px wiggle)
    const targetAmplitude = isPlaying ? height * 0.35 : 1.5;
    
    phase += isPlaying ? 0.08 : 0.015; // Speed of animation

    for (let i = 0; i < waveCount; i++) {
      ctx.beginPath();
      ctx.lineWidth = i === 0 ? 1.5 : 1;
      ctx.strokeStyle = colors[i];
      
      const frequency = 0.045 + i * 0.015;
      const wavePhase = phase + i * Math.PI * 0.4;
      const amplitude = targetAmplitude * (1 - i * 0.25);
      
      for (let x = 0; x < width; x++) {
        // Apply envelope so it tapers off beautifully at the left and right edges
        const envelope = Math.sin((x / width) * Math.PI);
        const y = height / 2 + Math.sin(x * frequency + wavePhase) * amplitude * envelope;
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    
    visualizerAnimationId = requestAnimationFrame(drawWave);
  };

  const startVisualizer = () => {
    if (!visualizerAnimationId) {
      drawWave();
    }
  };

  const stopVisualizer = () => {
    // Keep it wiggling gently instead of pausing the frame loop, 
    // so it transitions into a quiet float state
  };
  
  // Start the render loop initially so it wiggles gently on load
  startVisualizer();


  // --- 7. IMMERSIVE READER VIEW ---
  const openReader = (story) => {
    // Switch state inside Escritos tab
    textsListWrapper.style.display = "none";
    bookReaderView.classList.add("active");
    
    // Populate reader values
    readerGenre.textContent = story.genre;
    readerTitle.textContent = story.title;
    readerAuthor.textContent = story.narrator;
    readerTime.textContent = story.duration ? `${story.duration} de audio` : "";
    bookBodyContent.innerHTML = story.text;

    // Attach active data to read audio trigger button
    readerAudioBtn.setAttribute("data-id", story.id);
    
    updateReaderAudioButtonState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeReader = () => {
    bookReaderView.classList.remove("active");
    textsListWrapper.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  closeReaderBtn.addEventListener("click", closeReader);

  const updateReaderAudioButtonState = () => {
    const activeReaderId = readerAudioBtn.getAttribute("data-id");
    if (!activeReaderId) return;

    const isCurrentReadingPlaying = currentTrack && currentTrack.id === activeReaderId && isPlaying;

    if (isCurrentReadingPlaying) {
      readerAudioBtn.innerHTML = `<i data-lucide="pause"></i> Pausar Relato`;
      readerAudioBtn.style.background = "var(--accent-gold)";
    } else {
      readerAudioBtn.innerHTML = `<i data-lucide="play"></i> Escuchar Cuento`;
      readerAudioBtn.style.background = "var(--bg-pure-white)";
    }
    lucide.createIcons();
  };

  readerAudioBtn.addEventListener("click", () => {
    const activeReaderId = readerAudioBtn.getAttribute("data-id");
    const activeStory = stories.find(s => s.id === activeReaderId);
    if (activeStory) {
      loadAndPlayTrack(activeStory);
    }
  });

  // Font Size Adjusters
  fontSizeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      fontSizeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      const size = btn.getAttribute("data-size");
      // Remove all size classes and apply target
      bookTextWrapper.classList.remove("size-sm", "size-md", "size-lg");
      bookTextWrapper.classList.add(`size-${size}`);
    });
  });

  // Theme Toggle (Dark/Light Reading Theme)
  readerThemeToggle.addEventListener("click", () => {
    const isDark = bookTextWrapper.classList.contains("theme-dark");
    if (isDark) {
      bookTextWrapper.classList.remove("theme-dark");
      readerThemeToggle.style.background = "var(--bg-pure-white)";
      readerThemeToggle.style.color = "var(--text-charcoal)";
      readerThemeIcon.setAttribute("data-lucide", "moon");
    } else {
      bookTextWrapper.classList.add("theme-dark");
      readerThemeToggle.style.background = "var(--text-charcoal)";
      readerThemeToggle.style.color = "var(--bg-pure-white)";
      readerThemeIcon.setAttribute("data-lucide", "sun");
    }
    lucide.createIcons();
  });


  // --- 8. ADMIN UPLOAD SECTION ---
  
  // Drag and drop events
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
    dragZone.addEventListener(eventName, preventDefaults, false);
  });

  ["dragenter", "dragover"].forEach(eventName => {
    dragZone.addEventListener(eventName, () => dragZone.classList.add("dragover"), false);
  });

  ["dragleave", "drop"].forEach(eventName => {
    dragZone.addEventListener(eventName, () => dragZone.classList.remove("dragover"), false);
  });

  // File Drop
  dragZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleAudioFiles(files);
  });

  // Browse click
  dragZone.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    handleAudioFiles(fileInput.files);
  });

  const handleAudioFiles = (files) => {
    if (files.length === 0) return;
    const file = files[0];
    
    // Validate file type
    const validTypes = ["audio/mp3", "audio/mpeg", "audio/wav", "audio/x-wav"];
    if (validTypes.includes(file.type) || file.name.endsWith(".mp3") || file.name.endsWith(".wav")) {
      uploadedFile = file;
      
      // Update drag zone indicator UI
      fileIndicator.style.display = "flex";
      fileNameDisplay.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
      
      // Visual feedback
      dragZone.style.borderColor = "#2e7d32";
      dragZone.querySelector(".drag-drop-icon").style.color = "#2e7d32";
    } else {
      showToast("Por favor, sube solo archivos de audio .mp3 o .wav");
      resetDragZone();
    }
  };

  const resetDragZone = () => {
    uploadedFile = null;
    fileIndicator.style.display = "none";
    dragZone.style.borderColor = "var(--accent-gold)";
    const icon = dragZone.querySelector(".drag-drop-icon");
    if (icon) icon.style.color = "var(--accent-gold-dark)";
    fileInput.value = "";
  };

  // Helper to convert File to base64
  const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  // Form submit
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!uploadedFile) {
      showToast("Por favor, arrastra o selecciona un archivo de audio.");
      return;
    }

    // Limit size to 3.5MB to fit Vercel payload limit (4.5MB)
    const MAX_SIZE = 3.5 * 1024 * 1024;
    if (uploadedFile.size > MAX_SIZE) {
      showToast("El archivo excede el tamaño máximo recomendado (3.5 MB).");
      return;
    }

    const titleVal = document.getElementById("input-title").value;
    const narratorVal = document.getElementById("input-narrator").value;
    const genreVal = document.getElementById("input-genre").value;
    const coverVal = document.getElementById("select-cover").value;
    const synopsisVal = document.getElementById("input-synopsis").value;
    const textVal = document.getElementById("input-text").value;

    const overlay = document.getElementById("upload-loading-overlay");
    overlay.classList.add("active");

    try {
      showToast("Procesando pista de audio...");
      const base64Audio = await toBase64(uploadedFile);
      
      const payload = {
        title: titleVal,
        narrator: narratorVal,
        genre: genreVal,
        cover: coverVal,
        synopsis: synopsisVal,
        text: textVal.split("\n\n").map((para, i) => {
          if (i === 0 && !para.includes("class=")) {
            return `<p class="drop-cap">${para}</p>`;
          }
          return `<p>${para}</p>`;
        }).join("\n"),
        audioName: `${Date.now()}-${uploadedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
        audioBase64: base64Audio
      };

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Fallo en el servidor: ${response.status}`);
      }

      const resData = await response.json();
      console.log("Cargado con éxito:", resData);

      // Reset Form UI
      uploadForm.reset();
      resetDragZone();

      // Refetch from backend
      await fetchStories();

      showToast(`"${titleVal}" publicado exitosamente`);
      switchPage("page-stories");
    } catch (err) {
      console.error(err);
      showToast(`Error al publicar: ${err.message}`);
    } finally {
      overlay.classList.remove("active");
    }
  });


  // --- 9. TOAST NOTIFIER SYSTEM ---
  let toastTimer = null;
  const showToast = (message) => {
    toastMsg.textContent = message;
    toast.classList.add("show");

    if (toastTimer) clearTimeout(toastTimer);
    
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 4000);
  };


  // --- 10. RECYCLE BIN LOGIC & UI HANDLERS ---
  
  // Custom Confirm Modal State
  let confirmAction = null;
  const confirmModal = document.getElementById("confirm-modal");
  const confirmTitle = document.getElementById("confirm-modal-title");
  const confirmMsg = document.getElementById("confirm-modal-message");
  const confirmBtnConfirm = document.getElementById("confirm-modal-confirm");
  const confirmBtnCancel = document.getElementById("confirm-modal-cancel");

  const showConfirmModal = (title, message, onConfirm) => {
    confirmTitle.textContent = title;
    confirmMsg.textContent = message;
    confirmAction = onConfirm;
    confirmModal.classList.add("active");
  };

  const hideConfirmModal = () => {
    confirmModal.classList.remove("active");
    confirmAction = null;
  };

  confirmBtnCancel.addEventListener("click", hideConfirmModal);
  confirmBtnConfirm.addEventListener("click", () => {
    if (confirmAction) confirmAction();
    hideConfirmModal();
  });

  // API delete trigger calls
  const callDeleteAPI = async (storyId, action) => {
    const overlay = document.getElementById("upload-loading-overlay");
    const loadingMsg = document.getElementById("upload-loading-msg");
    
    if (action === 'delete') {
      loadingMsg.textContent = "Moviendo relato a la papelera...";
    } else if (action === 'restore') {
      loadingMsg.textContent = "Restaurando relato...";
    } else {
      loadingMsg.textContent = "Eliminando permanentemente...";
    }
    
    overlay.classList.add("active");

    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ storyId, action })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Fallo en el servidor: ${response.status}`);
      }

      await fetchStories();
      
      if (action === 'delete') {
        showToast("Relato enviado a la papelera");
      } else if (action === 'restore') {
        showToast("Relato restaurado con éxito");
      } else {
        showToast("Relato eliminado definitivamente");
      }
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message}`);
    } finally {
      overlay.classList.remove("active");
    }
  };

  const triggerDelete = (story) => {
    showConfirmModal(
      "¿Mover a la papelera?",
      `El relato "${story.title}" se ocultará del catálogo y se guardará en la papelera por 15 días antes de borrarse definitivamente.`,
      () => {
        callDeleteAPI(story.id, "delete");
      }
    );
  };

  const triggerRestore = (story) => {
    callDeleteAPI(story.id, "restore");
  };

  const triggerPermanentPurge = (story) => {
    showConfirmModal(
      "¿Eliminar permanentemente?",
      `¿Estás seguro de eliminar "${story.title}"? Esta acción es irreversible y borrará el archivo físico de audio de los servidores.`,
      () => {
        callDeleteAPI(story.id, "permanent");
      }
    );
  };

  // Render Recycle Bin list inside Admin Panel
  const renderRecycleBin = () => {
    const container = document.getElementById("trash-list-container");
    const badgeCount = document.getElementById("trash-badge-count");
    
    const deletedStories = stories.filter(s => s.deleted);
    badgeCount.textContent = deletedStories.length;
    container.innerHTML = "";

    if (deletedStories.length === 0) {
      container.innerHTML = `<div class="trash-empty-state">La papelera está vacía.</div>`;
      return;
    }

    deletedStories.forEach(story => {
      const now = new Date();
      const deletedDate = new Date(story.deletedAt);
      const diffTime = now - deletedDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, 15 - diffDays);

      const row = document.createElement("div");
      row.className = "trash-item-row";
      row.innerHTML = `
        <img src="${story.cover}" alt="${story.title}" class="trash-item-cover">
        <div class="trash-item-info">
          <h4>${story.title}</h4>
          <p>Narrador: ${story.narrator} &bull; Categoría: ${story.genre}</p>
        </div>
        <div class="trash-item-days ${daysRemaining <= 3 ? '' : 'safe'}">
          <i data-lucide="clock" style="width: 14px; height: 14px; display: inline; vertical-align: middle; margin-right: 4px;"></i>
          ${daysRemaining} días restantes
        </div>
        <div class="trash-item-actions">
          <button class="trash-btn trash-btn-restore" data-id="${story.id}">
            <i data-lucide="rotate-ccw" style="width: 14px; height: 14px;"></i> Restaurar
          </button>
          <button class="trash-btn trash-btn-purge" data-id="${story.id}">
            <i data-lucide="trash" style="width: 14px; height: 14px;"></i> Purgar
          </button>
        </div>
      `;

      row.querySelector(".trash-btn-restore").addEventListener("click", () => {
        triggerRestore(story);
      });
      row.querySelector(".trash-btn-purge").addEventListener("click", () => {
        triggerPermanentPurge(story);
      });

      container.appendChild(row);
    });

    lucide.createIcons();
  };

  // Admin sub-tabs toggle handlers
  const tabBtnUpload = document.getElementById("tab-btn-upload");
  const tabBtnTrash = document.getElementById("tab-btn-trash");
  const panelUpload = document.getElementById("panel-upload");
  const panelTrash = document.getElementById("panel-trash");

  tabBtnUpload.addEventListener("click", () => {
    tabBtnUpload.classList.add("active");
    tabBtnTrash.classList.remove("active");
    panelUpload.classList.add("active");
    panelTrash.classList.remove("active");
  });

  tabBtnTrash.addEventListener("click", () => {
    tabBtnTrash.classList.add("active");
    tabBtnUpload.classList.remove("active");
    panelTrash.classList.add("active");
    panelUpload.classList.remove("active");
    renderRecycleBin();
  });


  // --- 11. APP STARTUP EXECUTION ---
  const fetchStories = async () => {
    try {
      const response = await fetch('/api/stories');
      if (response.ok) {
        stories = await response.json();
      } else {
        console.warn("API stories load failed. Falling back to data.js.");
        stories = [...window.initialStories];
      }
    } catch (err) {
      console.warn("Failed to contact stories API, using local fallback data.js:", err);
      stories = [...window.initialStories];
    }
    
    // Render all active sections
    renderStories();
    renderTexts();
    
    // Update trash badge count and list
    const deletedCount = stories.filter(s => s.deleted).length;
    document.getElementById("trash-badge-count").textContent = deletedCount;
    if (panelTrash.classList.contains("active")) {
      renderRecycleBin();
    }
  };

  fetchStories();
  
  // Set active header styles on load
  switchPage("page-stories");
});
