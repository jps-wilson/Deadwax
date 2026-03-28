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
let playbackQueue = null;

// promise that resolves when Spotify controller is ready
let spotifyReadyResolve;
const spotifyReady = new Promise((resolve) => {
  spotifyReadyResolve = resolve;
});

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

  // Show record
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

  // Update now playing display
  if (nowPlaying) {
    nowPlaying.innerHTML = `
      <span class="now-playing-text">Ready to play</span>
      <span class="now-playing-title">${album.name}</span>
      <span class="now-playing-artist">${album.artist}</span>
    `;
  }

  // Don't call startPlayBack() immediately -> let user press play, or rely on promise-safe playback logic
}

// TODO: review this section of code
// Track Section
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

  // TODO: check if I still need this code
  const playableRadius = maxRadius - labelRadius;
  const distanceFromEdge = maxRadius - distance;
  const normalizedPosition = distanceFromEdge / playableRadius;

  const trackNumber = Math.ceil(normalizedPosition * state.totalTracks);
  const clampedTrack = Math.max(1, Math.min(trackNumber, state.totalTracks));

  state.currentTrack = clampedTrack;
  updateArmPositionForTrack(clampedTrack);

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

// TODO: check if I still need this code now
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

// function skipToTrack(trackNumber) {
//   if (!spotifyController || !state.currentAlbum) return;
//   spotifyController.loadUri(`spotify:album:${state.currentAlbum.spotifyId}`);
//   if (trackNumber > 1) {
//     let skipsRemaining = trackNumber - 1;
//     function doSkip() {
//       if (skipsRemaining > 0) {
//         spotifyController.next();
//         skipsRemaining--;
//         setTimeout(doSkip, 500);
//       }
//     }
//     setTimeout(doSkip, 800);
//   }
// }

// Playback Controls

async function startPlayback() {
  if (!state.recordLoaded || !state.currentAlbum) return;

  // wait for spotify controller to be ready
  await spotifyReady;

  state.playing = true;

  // ui updates
  if (looseRecord) looseRecord.classList.add("spinning");
  moveArm(true);
  if (led) led.classList.add("on");
  if (strobeLight) strobeLight.classList.add("on");

  if (nowPlaying) {
    nowPlaying.classList.add("active");
    nowPlaying.innerHTML = `
      <span class="now-playing-text">Now Playing - Track ${state.currentTrack}</span>
      <span class="now-playing-title">${state.currentAlbum.name}</span>
      <span class="now-playing-artist">${state.currentAlbum.artist}</span>
    `;
  }

  updateSpinDuration();

  // Spotify playback logic: load album only if not already loaded
  if (spotifyController) {
    // check if current album is already loaded
    if (
      !state._spotifyLoadedAlbumId ||
      state._spotifyLoadedAlbumId !== state.currentAlbum.spotifyId
    ) {
      // load album
      await new Promise((resolve) => {
        spotifyController.loadUri(
          `spotify:album:${state.currentAlbum.spotifyId}`,
        );
        // give Spotify controller time to load before skipping
        setTimeout(resolve, 500);
      });
      state._spotifyLoadedAlbumId = state.currentAlbum.spotifyId;
    }

    // skip to desired track if needed
    if (state.currentTrack > 1) {
      let skipsRemaining = state.currentTrack - 1;
      function skipAndPlay() {
        if (skipsRemaining > 0) {
          spotifyController.next();
          skipsRemaining--;
          setTimeout(skipAndPlay, 400);
        } else {
          spotifyController.resume();
        }
      }
      skipAndPlay();
    } else {
      spotifyController.resume();
    }
  }
}

async function stopPlayback() {
  state.playing = false;

  // updates ui
  if (looseRecord) looseRecord.classList.remove("spinning");
  moveArm(false);
  if (led) led.classList.remove("on");
  if (strobeLight) strobeLight.classList.remove("on");
  if (nowPlaying) nowPlaying.classList.remove("active");

  // wait for Spotify controller to be ready before pausing
  await spotifyReady;
  if (spotifyController) spotifyController.pause();
}

function togglePlay() {
  if (!state.recordLoaded) {
    if (startStopBtn) {
      startStopBtn.classList.add("shake");
      setTimeout(() => startStopBtn.classList.remove("shake"), 300);
    }
    return;
  }

  if (state.playing) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

// Speed control buttons
function updateSpinDuration() {
  const baseDuration = state.speed === 33 ? 1.8 : 1.35;
  const adjustedDuration = Math.max(
    0.3,
    baseDuration * (1 - state.pitch * 0.08),
  );

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

// Spotify iframe API
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
    if (typeof spotifyReadyResolve === "function") spotifyReadyResolve();

    controller.addListener("playback_update", (e) => {
      const data = e.data;
      if (!data || !data.track) return;

      const trackName = data.track.name;
      const artistName =
        data.track.artists?.[0]?.name || state.currentAlbum?.artist || "";
      const albumName =
        data.track.album?.name || state.currentAlbum?.name || "";

      if (nowPlaying && state.playing) {
        nowPlaying.innerHTML = `
          <span class="now-playing-text">Now Playing</span>
          <span class="now-playing-title">${trackName}</span>
          <span class="now-playing-artist>${artistName} - ${albumName}</span>
        `;
      }
    });
  });
};

// Fetching album art
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

renderAlbumList();
updateAlbumCovers();

// Mobile touch drag support
function setupTouchDrag(albumCards) {
  albumCards.forEach((card) => {
    let touchDragPreview = null;
    let draggedAlbum = null;

    card.addEventListener("touchstart", async (e) => {
      const albumId = card.dataset.albumId;
      draggedAlbum = spotifyAlbums.find((a) => a.id === albumId);
      if (!draggedAlbum) return;

      touchDragPreview = document.createElement("div");
      touchDragPreview.classList.add("drag-preview-record");

      const vinyl = document.createElement("div");
      vinyl.classList.add("drag-preview-vinyl");

      const label = document.createElement("div");
      label.classList.add("drag-preview-label");
      if (draggedAlbum.coverUrl)
        label.style.backgroundImage = `url(${draggedAlbum.coverUrl})`;

      vinyl.appendChild(label);
      touchDragPreview.appendChild(vinyl);
      document.body.appendChild(touchDragPreview);

      const touch = e.touches[0];
      touchDragPreview.style.left = touch.clientX + "px";
      touchDragPreview.style.top = touch.clientY + "px";

      e.preventDefault();
    });

    card.addEventListener("touchmove", (e) => {
      if (!touchDragPreview) return;
      const touch = e.touches[0];

      // Move preview with finger
      touchDragPreview.style.left = touch.clientX + "px";
      touchDragPreview.style.top = touch.clientY + "px";

      // Highlight if over the platter
      const platterRect = playerElement
        .querySelector(".platter")
        .getBoundingClientRect();
      if (
        touch.clientX >= platterRect.left &&
        touch.clientX <= platterRect.right &&
        touch.clientY >= platterRect.top &&
        touch.clientY <= platterRect.bottom
      ) {
        touchDragPreview.classList.add("active-over-platter");
      } else {
        touchDragPreview.classList.remove("active-over-platter");
      }

      e.preventDefault();
    });

    card.addEventListener("touchend", (e) => {
      if (!touchDragPreview || !draggedAlbum) return;

      const touch = e.changedTouches[0];
      const platterRect = playerElement
        .querySelector(".platter")
        .getBoundingClientRect();

      // Snap to platter if released over it
      if (
        touch.clientX >= platterRect.left &&
        touch.clientX <= platterRect.right &&
        touch.clientY >= platterRect.top &&
        touch.clientY <= platterRect.bottom
      ) {
        loadAlbumOntoPlatter(draggedAlbum);

        // Animate snapping
        touchDragPreview.style.transition = "all 0.2s ease";
        touchDragPreview.style.left =
          platterRect.left + platterRect.width / 2 + "px";
        touchDragPreview.style.top =
          platterRect.top + platterRect.height / 2 + "px";
        touchDragPreview.style.transform = "translate(-50%, -50%) scale(1)";
        setTimeout(() => touchDragPreview.remove(), 220);
      } else {
        touchDragPreview.remove();
      }

      touchDragPreview = null;
      draggedAlbum = null;
    });
  });
}
setupTouchDrag(document.querySelectorAll(".album-card"));

// Overlay on page load with guided tooltip sequence logic
const overlay = document.getElementById("firstTimeOverlay");
const overlayDismiss = document.getElementById("overlayDismiss");

if (overlay && overlayDismiss) {
  const overlayShown = sessionStorage.getItem("deadwaxOverlayShown");

  if (!overlayShown) {
    overlay.style.display = "flex";
  } else {
    overlay.style.display = "none";
  }

  overlayDismiss.addEventListener("click", () => {
    overlay.style.display = "none";
    sessionStorage.setItem("deadwaxOverlayShown", true);
  });
}

// Mobile: Draggable Now Playing Display
function setupMobileNowPlayingDrag() {
  const nowPlayingEl = document.querySelector(".now-playing");
  if (!nowPlayingEl) return;

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function startDrag(e) {
    if (window.innerWidth > 768) return; // only on mobile
    const touch = e.touches ? e.touches[0] : e;
    isDragging = true;
    const rect = nowPlayingEl.getBoundingClientRect();
    offsetX = touch.clientX - rect.left;
    offsetY = touch.clientY - rect.top;
    nowPlayingEl.classList.add("dragging");
    e.preventDefault();
  }

  function dragMove(e) {
    if (!isDragging) return;
    const touch = e.touches ? e.touches[0] : e;
    nowPlayingEl.style.left = touch.clientX - offsetX + "px";
    nowPlayingEl.style.top = touch.clientY - offsetY + "px";
    nowPlayingEl.style.right = "auto";
    nowPlayingEl.style.bottom = "auto";
  }

  function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    nowPlayingEl.classList.remove("dragging");
  }

  nowPlayingEl.addEventListener("touchstart", startDrag);
  nowPlayingEl.addEventListener("mousedown", startDrag);

  document.addEventListener("touchmove", dragMove);
  document.addEventListener("mousemove", dragMove);

  document.addEventListener("touchend", stopDrag);
  document.addEventListener("mouseup", stopDrag);
}

setupMobileNowPlayingDrag();
