/* MagicMirror Module: MMM-GoogleDrivePhotos
 * Displays random photos from a Google Drive folder
 */

Module.register("MMM-GoogleDrivePhotos", {
  // Default configuration
  defaults: {
    folderId: "",                   // Google Drive folder ID (required)
    updateInterval: 30 * 1000,      // How often to change photos (30 seconds)
    transitionSpeed: 2000,          // Fade transition duration (ms)
    maxWidth: "100%",               // Maximum width of photos
    maxHeight: "100%",              // Maximum height of photos
    opacity: 1.0,                   // Photo opacity (0.0 - 1.0)
    mode: "contain",                // "cover", "contain", or "fill"
    showPhotoInfo: false,           // Show photo metadata
    shuffle: true,                  // Randomize photo order
    refreshInterval: 30 * 60 * 1000, // Refresh folder contents every 30 minutes
    recursiveSearch: false,         // Include subfolders
  },

  // Internal state
  photos: [],
  currentIndex: 0,
  activeSlot: 0,
  loaded: false,

  // Required styles
  getStyles: function () {
    return ["MMM-GoogleDrivePhotos.css"];
  },

  // Module startup
  start: function () {
    Log.info(`Starting module: ${this.name}`);
    
    if (!this.config.folderId) {
      Log.error("MMM-GoogleDrivePhotos: folderId is required in config!");
      return;
    }

    this.sendSocketNotification("INIT", this.config);
    this.scheduleRefresh();
  },

  // Create the DOM elements
  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "mmm-gdrivephotos-wrapper";

    if (!this.loaded) {
      wrapper.innerHTML = `<div class="mmm-gdrivephotos-loading">Loading photos...</div>`;
      return wrapper;
    }

    if (this.photos.length === 0) {
      wrapper.innerHTML = `<div class="mmm-gdrivephotos-error">No photos found in folder</div>`;
      return wrapper;
    }

    // Create two image slots for smooth crossfade transitions
    for (let i = 0; i < 2; i++) {
      const slot = document.createElement("div");
      slot.className = `mmm-gdrivephotos-slot slot-${i}`;
      slot.style.opacity = i === this.activeSlot ? 1 : 0;
      
      const img = document.createElement("img");
      img.className = "mmm-gdrivephotos-image";
      img.style.objectFit = this.config.mode;
      img.style.maxWidth = this.config.maxWidth;
      img.style.maxHeight = this.config.maxHeight;
      img.style.opacity = this.config.opacity;
      
      slot.appendChild(img);
      wrapper.appendChild(slot);
    }

    // Photo info overlay (optional)
    if (this.config.showPhotoInfo) {
      const info = document.createElement("div");
      info.className = "mmm-gdrivephotos-info";
      wrapper.appendChild(info);
    }

    return wrapper;
  },

  // Handle socket notifications from node_helper
  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case "PHOTOS_LOADED":
        this.handlePhotosLoaded(payload);
        break;
      case "PHOTO_DATA":
        this.displayPhoto(payload);
        break;
      case "ERROR":
        Log.error(`MMM-GoogleDrivePhotos Error: ${payload}`);
        this.loaded = true;
        this.updateDom();
        break;
    }
  },

  // Process loaded photos
  handlePhotosLoaded: function (photos) {
    Log.info(`MMM-GoogleDrivePhotos: Loaded ${photos.length} photos`);
    
    this.photos = photos;
    
    if (this.config.shuffle) {
      this.shufflePhotos();
    }
    
    this.loaded = true;
    this.currentIndex = 0;
    this.updateDom();

    // Start the slideshow after DOM is ready
    setTimeout(() => {
      this.showNextPhoto();
      this.scheduleNextPhoto();
    }, 1000);
  },

  // Fisher-Yates shuffle
  shufflePhotos: function () {
    for (let i = this.photos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.photos[i], this.photos[j]] = [this.photos[j], this.photos[i]];
    }
  },

  // Request the next photo
  showNextPhoto: function () {
    if (this.photos.length === 0) return;

    const photo = this.photos[this.currentIndex];
    this.sendSocketNotification("GET_PHOTO", {
      photo: photo,
      width: window.innerWidth,
      height: window.innerHeight,
    });

    this.currentIndex = (this.currentIndex + 1) % this.photos.length;
    
    // Reshuffle when we've shown all photos
    if (this.currentIndex === 0 && this.config.shuffle) {
      this.shufflePhotos();
    }
  },

  // Display the photo with crossfade
  displayPhoto: function (photoData) {
    const slots = document.querySelectorAll(".mmm-gdrivephotos-slot");
    if (slots.length < 2) return;

    const nextSlot = 1 - this.activeSlot;
    const nextImg = slots[nextSlot].querySelector("img");
    
    // Load new image
    nextImg.onload = () => {
      // Crossfade transition
      slots[this.activeSlot].style.opacity = 0;
      slots[nextSlot].style.opacity = 1;
      this.activeSlot = nextSlot;

      // Update photo info if enabled
      if (this.config.showPhotoInfo && photoData.metadata) {
        this.updatePhotoInfo(photoData.metadata);
      }
    };

    nextImg.onerror = () => {
      Log.error("MMM-GoogleDrivePhotos: Failed to load image, skipping...");
      // Try next photo
      setTimeout(() => this.showNextPhoto(), 1000);
    };

    nextImg.src = photoData.url;
  },

  // Update the photo info overlay
  updatePhotoInfo: function (metadata) {
    const info = document.querySelector(".mmm-gdrivephotos-info");
    if (!info) return;

    let text = "";
    if (metadata.createdTime) {
      const date = new Date(metadata.createdTime);
      text = date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    if (metadata.name) {
      // Remove file extension from display name
      const displayName = metadata.name.replace(/\.[^/.]+$/, "");
      text += text ? ` • ${displayName}` : displayName;
    }
    
    info.textContent = text;
    info.style.opacity = text ? 1 : 0;
  },

  // Schedule the next photo change
  scheduleNextPhoto: function () {
    setInterval(() => {
      this.showNextPhoto();
    }, this.config.updateInterval);
  },

  // Periodically refresh the folder to catch new photos
  scheduleRefresh: function () {
    setInterval(() => {
      Log.info("MMM-GoogleDrivePhotos: Refreshing folder contents");
      this.sendSocketNotification("REFRESH_FOLDER", this.config);
    }, this.config.refreshInterval);
  },

  // Handle notifications from other modules
  notificationReceived: function (notification, payload, sender) {
    switch (notification) {
      case "GDRIVEPHOTOS_NEXT":
        this.showNextPhoto();
        break;
      case "GDRIVEPHOTOS_PAUSE":
        // Could implement pause functionality
        break;
      case "GDRIVEPHOTOS_RESUME":
        // Could implement resume functionality
        break;
    }
  },
});
