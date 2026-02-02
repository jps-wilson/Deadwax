// SPOTIFY ALBUMS //
const spotifyAlbums = [
  {
    id: "1",
    name: "Purple Rain",
    artist: "Prince And The Revolution",
    spotifyId: "7nXJ5k4XgRj5OLg9m8V3zc",
    coverUrl: "",
    totalTracks: 9,
  },
  {
    id: "2",
    name: "Dark Side of the Moon",
    artist: "Pink Floyd",
    spotifyId: "4LH4d3cOWNNsVw41Gqt2kv",
    coverUrl: "",
    totalTracks: 10,
  },
  {
    id: "3",
    name: "Can't Buy A Thrill",
    artist: "Steely Dan",
    spotifyId: "6DlSUW5gmq6Byc3osKDJ2p",
    coverUrl: "",
    totalTracks: 7,
  },
  {
    id: "4",
    name: "Rumours",
    artist: "Fleetwood Mac",
    spotifyId: "1bt6q2SruMsBtcerNVtpZB",
    coverUrl: "",
    totalTracks: 11,
  },
  {
    id: "5",
    name: "Abbey Road",
    artist: "The Beatles",
    spotifyId: "0ETFjACtuP2ADo6LFhL6HN",
    coverUrl: "",
    totalTracks: 17,
  },
  {
    id: "6",
    name: "Thriller",
    artist: "Michael Jackson",
    spotifyId: "2ANVost0y2y52ema1E9xAZ",
    coverUrl: "",
    totalTracks: 9,
  },
];

// DOM ELEMENTS //
const looseRecord = document.querySelector(".lp");
const armContainer = document.querySelector(".arm-container");
const led = document.querySelector(".led");
const strobeLight = document.querySelector(".strobe-light");
const startStopBtn = document.querySelector(".start-stop");
const speedBtns = document.querySelectorAll(".speed-btn");
const nowPlaying = document.querySelector(".now-playing");
const collectionList = document.getElementById("collectionList");
const playerElement = document.querySelector(".player");
const volumeKnob = document.querySelector(".knob.top");
const pitchSlider = document.querySelector(".pitch-slider");
const ARM_REST = -20;
const ARM_START = 0;
const ARM_END = -60;

function moveArm(isPlaying) {
  const needleArm = document.querySelector(".arm");
  if (!needleArm) return;

  if (isPlaying) {
    needleArm.style.transform = "rotate(35deg)";
    needleArm.style.transformOrigin = "-5% 50%";
  } else {
    needleArm.style.transform = "rotate(0deg)";
    needleArm.style.transformOrigin = "-5% 50%";
  }
}

if (pitchSlider) {
  pitchSlider.addEventListener("input", (e) => {
    if (!state.recordLoaded) return;
    state.pitch = parseInt(e.target.value, 10);
    updateSpinDuration();
    console.log("Pitch set to", state.pitch);
  });
}

let isDraggingVolume = false;

if (volumeKnob) {
  volumeKnob.addEventListener("mousedown", (e) => {
    if (!state.recordLoaded) return;
    isDraggingVolume = true;
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDraggingVolume) return;
    const rect = volumeKnob.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = Math.max(-135, Math.min(angle, 135));
    const volume = (angle + 135) / 270;
    state.volume = volume;
    volumeKnob.style.transform = `rotate(${angle}deg)`;
    console.log("Volume set to", state.volume.toFixed(2));
  });

  document.addEventListener("mouseup", () => {
    isDraggingVolume = false;
    document.body.style.userSelect = "";
  });
}

// STATE //
const state = {
  playing: false,
  recordLoaded: false,
  currentAlbum: null,
  speed: 33,
  totalTracks: 10,
  currentTrack: 1,
  pitch: 0,
  baseSpeed: 1.8,
  volume: 0.5,
};

// Spotify Controller
let spotifyController = null;

// Drag state
let albumDragging = false;
let draggedAlbum = null;

let dragPreview = null;

function createDragPreview(album) {
  // Remove existing preview
  if (dragPreview) dragPreview.remove();

  dragPreview = document.createElement("div");
  dragPreview.classList.add("drag-preview-record");

  const vinyl = document.createElement("div");
  vinyl.classList.add("drag-preview-vinyl");

  const label = document.createElement("div");
  label.classList.add("drag-preview-label");

  if (album.coverUrl) {
    label.style.backgroundImage = `url(${album.coverUrl})`;
  }

  vinyl.appendChild(label);
  dragPreview.appendChild(vinyl);
  document.body.appendChild(dragPreview);
}

// Render album list
function renderAlbumList() {
  if (!collectionList) {
    console.error("Collection list element not found");
    return;
  }

  collectionList.innerHTML = spotifyAlbums
    .map(
      (album) => `
    <div class="album-card" 
         data-album-id="${album.id}"
         draggable="true">
      <img class="album-cover" 
           src="${album.coverUrl || "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%228%22>Loading...</text></svg>"}" 
           alt="${album.name}">
      <div class="album-info">
        <p class="album-title">${album.name}</p>
        <p class="album-artist">${album.artist}</p>
      </div>
    </div>
  `,
    )
    .join("");

  setupDragAndDrop();
}

// Drag & Drop
function setupDragAndDrop() {
  const albumCards = document.querySelectorAll(".album-card");

  albumCards.forEach((card) => {
    card.addEventListener("dragstart", handleDragStart);
    card.addEventListener("dragend", handleDragEnd);
  });

  if (playerElement) {
    playerElement.addEventListener("dragover", handleDragOver);
    playerElement.addEventListener("dragleave", handleDragLeave);
    playerElement.addEventListener("drop", handleDrop);
  }
}

function handleDragStart(e) {
  const card = e.target.closest(".album-card");
  if (!card) return;
  const albumId = card.dataset.albumId;
  const album = spotifyAlbums.find((a) => a.id === albumId);
  if (!album) return;
  albumDragging = true;
  draggedAlbum = album;
  card.classList.add("dragging");
  if (playerElement) playerElement.classList.add("drop-active");
  e.dataTransfer.effectAllowed = "copy";
  e.dataTransfer.setData("text/plain", albumId);
}

function handleDragEnd(e) {
  albumDragging = false;
  draggedAlbum = null;

  document.querySelectorAll(".album-card").forEach((card) => {
    card.classList.remove("dragging");
  });

  if (playerElement) {
    playerElement.classList.remove("drop-active");
  }

  // Clean up any remaining previews
  const previews = document.querySelectorAll(".drag-preview-record");
  previews.forEach((p) => p.remove());
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";

  if (playerElement) {
    playerElement.classList.add("drop-active");
  }
}

function handleDragLeave(e) {
  if (playerElement && !playerElement.contains(e.relatedTarget)) {
    playerElement.classList.remove("drop-active");
  }
}

function handleDrop(e) {
  e.preventDefault();

  if (playerElement) {
    playerElement.classList.remove("drop-active");
  }

  // Get album from dataTransfer if draggedAlbum is null
  if (!draggedAlbum) {
    const albumId = e.dataTransfer.getData("text/plain");
    draggedAlbum = spotifyAlbums.find((a) => a.id === albumId);
  }

  if (draggedAlbum) {
    loadAlbumOntoPlatter(draggedAlbum);
  }

  albumDragging = false;
  draggedAlbum = null;
}

// Loads album onto platter
function loadAlbumOntoPlatter(album) {
  if (state.playing) stopPlayback();

  state.currentAlbum = album;
  state.recordLoaded = true;
  state.currentTrack = 1;
  state.totalTracks = album.totalTracks || 10;

  // show record
  if (looseRecord) {
    looseRecord.style.display = "block";
    looseRecord.classList.add("on-platter");
    looseRecord.classList.remove("spinning");

    const label = looseRecord.querySelector(".label");
    if (label) {
      if (album.coverUrl) {
        label.style.backgroundImage = `url(${album.coverUrl})`;
        label.classList.add("has-art");
      } else {
        label.style.backgroundImage = "";
        label.classList.remove("has-art");
      }
    }
  }

  // Move arm onto lp when dropped
  moveArm(true);
  console.log(`Record dropped: ${album.name} by ${album.artist}`);

  // update now playing display
  if (nowPlaying) {
    nowPlaying.innerHTML = `
      <span class="now-playing-text">Ready to play</span>
      <span class="now-playing-title">${album.name}</span>
      <span class="now-playing-artist">${album.artist}</span>
    `;
  }

  // spotify
  if (spotifyController) {
    spotifyController.loadUri(`spotify:album:${album.spotifyId}`);
  }

  // auto-start playback after arm reaches the record
  setTimeout(() => startPlayback(), 600);
}

// TRACK SELECTION
function setupTrackSelection() {
  const record = document.querySelector(".record");
  if (!record) {
    console.log("Record element not found for track selection");
    return;
  }

  // Remove existing listener to avoid duplicates
  record.removeEventListener("click", handleTrackClick);
  record.addEventListener("click", handleTrackClick);
  console.log("Track selection enabled");
}

function handleTrackClick(e) {
  if (!state.recordLoaded) {
    console.log("No record loaded");
    return;
  }

  if (state.playing) {
    console.log("Stop playback first to select a track");
    return;
  }

  const record = e.currentTarget;
  const rect = record.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const dx = e.clientX - centerX;
  const dy = e.clientY - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const maxRadius = rect.width / 2;
  const labelRadius = maxRadius * 0.35;

  // Ignore clicks on the label
  if (distance < labelRadius) {
    console.log("Clicked on label, ignoring");
    return;
  }

  // Map distance to track number (outer = track 1, inner = last track)
  const playableRadius = maxRadius - labelRadius;
  const distanceFromEdge = maxRadius - distance;
  const normalizedPosition = distanceFromEdge / playableRadius;

  const trackNumber = Math.ceil(normalizedPosition * state.totalTracks);
  const clampedTrack = Math.max(1, Math.min(trackNumber, state.totalTracks));

  state.currentTrack = clampedTrack;
  updateArmPositionForTrack(clampedTrack);

  // Visual feedback
  record.classList.add("track-selected");
  setTimeout(() => record.classList.remove("track-selected"), 200);

  console.log(`Selected track ${clampedTrack} of ${state.totalTracks}`);

  // Update now playing text
  if (nowPlaying && state.currentAlbum) {
    nowPlaying.innerHTML = `
      <span class="now-playing-text">Track ${clampedTrack} selected</span>
      <span class="now-playing-title">${state.currentAlbum.name}</span>
      <span class="now-playing-artist">${state.currentAlbum.artist}</span>
    `;
  }
}

function updateArmPositionForTrack(trackNumber) {
  const progress = (trackNumber - 1) / Math.max(1, state.totalTracks - 1);
  const angle = ARM_START + progress * (ARM_END - ARM_START);

  const needleArm = document.querySelector(".arm");
  if (!needleArm) return;

  if (state.recordLoaded) {
    needleArm.style.transform = `rotate(${angle}deg)`;
  } else {
    needleArm.style.transform = `rotate(${ARM_REST}deg)`;
  }
}

function skipToTrack(trackNumber) {
  if (!spotifyController || !state.currentAlbum) return;
  spotifyController.loadUri(`spotify:album:${state.currentAlbum.spotifyId}`);
  if (trackNumber > 1) {
    let skipsRemaining = trackNumber - 1;
    function doSkip() {
      if (skipsRemaining > 0) {
        spotifyController.next();
        skipsRemaining--;
        setTimeout(doSkip, 500); // Increased delay for reliability
      }
    }
    setTimeout(doSkip, 800);
  }
}

// ============================================
// PLAYBACK CONTROLS
// ============================================

function startPlayback() {
  if (!state.recordLoaded) {
    console.log("No record loaded");
    return;
  }
  state.playing = true;

  if (looseRecord) {
    looseRecord.classList.add("spinning");
  }

  // Animate arm onto LP
  const needleArm = document.querySelector(".arm");
  if (needleArm) {
    needleArm.classList.remove("rest");
    needleArm.classList.add("playing");
  }

  if (led) {
    led.classList.add("on");
  }

  if (strobeLight) {
    strobeLight.classList.add("on");
  }

  if (nowPlaying) {
    nowPlaying.classList.add("active");
    if (state.currentAlbum) {
      nowPlaying.innerHTML = `
        <span class="now-playing-text">Now Playing - Track ${state.currentTrack}</span>
        <span class="now-playing-title">${state.currentAlbum.name}</span>
        <span class="now-playing-artist">${state.currentAlbum.artist}</span>
      `;
    }
  }
  // Arm drift and position update removed
  updateSpinDuration();

  // Start Spotify playback
  if (spotifyController && state.currentAlbum) {
    console.log(`Starting playback from track ${state.currentTrack}`);

    // Load album first
    spotifyController.loadUri(`spotify:album:${state.currentAlbum.spotifyId}`);

    // Wait for load, then skip to track and play
    setTimeout(() => {
      if (state.currentTrack > 1) {
        // Skip to the selected track
        let skipsRemaining = state.currentTrack - 1;

        function skipAndPlay() {
          if (skipsRemaining > 0) {
            spotifyController.next();
            skipsRemaining--;
            console.log(`Skipping... ${skipsRemaining} remaining`);

            if (skipsRemaining > 0) {
              setTimeout(skipAndPlay, 350);
            } else {
              // Done skipping, now play
              setTimeout(() => {
                spotifyController.resume();
                console.log("Playback started");
              }, 300);
            }
          }
        }

        skipAndPlay();
      } else {
        // Track 1, just play
        spotifyController.resume();
        console.log("Playback started at track 1");
      }
    }, 500);
  }
}

function stopPlayback() {
  state.playing = false;

  if (looseRecord) {
    looseRecord.classList.remove("spinning");
  }

  // Animate arm off LP
  const needleArm = document.querySelector(".arm");
  if (needleArm) {
    needleArm.classList.remove("playing");
    needleArm.classList.add("rest");
  }

  if (led) {
    led.classList.remove("on");
  }

  if (strobeLight) {
    strobeLight.classList.remove("on");
  }

  if (nowPlaying) {
    nowPlaying.classList.remove("active");
  }

  if (spotifyController) {
    spotifyController.pause();
    console.log("Playback paused");
  }

  // Arm drift and position update removed
}

function togglePlay() {
  if (!state.recordLoaded) {
    if (startStopBtn) {
      startStopBtn.classList.add("shake");
      setTimeout(() => startStopBtn.classList.remove("shake"), 300);
    }
    return;
  }

  const isPlaying = !state.playing; // checks state

  if (state.playing) {
    stopPlayback();
  } else {
    startPlayback();
  }

  // Update arm position
  moveArm(isPlaying);
}

// ============================================
// SPEED CONTROL
// ============================================
function updateSpinDuration() {
  const baseDuration = state.speed === 33 ? 1.8 : 1.35;
  const adjustedDuration = baseDuration * (1 - state.pitch * 0.08);

  if (looseRecord) {
    looseRecord.style.setProperty("--spin-duration", `${adjustedDuration}s`);
  }
}

// Speed button listeners
if (speedBtns) {
  speedBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      speedBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.speed = parseInt(btn.dataset.speed, 10);
      updateSpinDuration();
    });
  });
}

// Start/Stop button listener
if (startStopBtn) {
  startStopBtn.addEventListener("click", togglePlay);
}

// Set arm to rest position initially
if (armContainer) {
  armContainer.classList.add("rest");
}

// ============================================
// SPOTIFY IFRAME API
// ============================================
window.onSpotifyIframeApiReady = (IFrameAPI) => {
  console.log("Spotify IFrame API ready");

  const element = document.getElementById("spotifyEmbed");
  const options = {
    uri: "spotify:album:7nXJ5k4XgRj5OLg9m8V3zc",
    width: "100%",
    height: "152",
  };

  IFrameAPI.createController(element, options, (controller) => {
    spotifyController = controller;
    console.log("Spotify controller ready");

    // Note: Spotify Embed API has limited methods:
    // - play()
    // - togglePlay()
    // - pause()
    // - resume()
    // - seek(seconds)
    // - loadUri(uri)
    // - next()
    // - previous()
    // Volume is controlled by the user via the embed UI, not programmatically
  });
};

// ============================================
// FETCH ALBUM ART
// ============================================
async function fetchAlbumArt(spotifyId) {
  try {
    const response = await fetch(
      `https://open.spotify.com/oembed?url=https://open.spotify.com/album/${spotifyId}`,
    );
    const data = await response.json();
    return data.thumbnail_url;
  } catch (error) {
    console.error("Failed to fetch album art:", error);
    return null;
  }
}

async function updateAlbumCovers() {
  for (const album of spotifyAlbums) {
    const coverUrl = await fetchAlbumArt(album.spotifyId);
    if (coverUrl) {
      album.coverUrl = coverUrl;
      // Update all matching album covers (in case of multiple renders)
      document
        .querySelectorAll(`[data-album-id="${album.id}"] .album-cover`)
        .forEach((card) => {
          card.src = coverUrl;
        });
    }
  }
}

// ============================================
// INITIALIZE
// ============================================
renderAlbumList();
updateAlbumCovers();
