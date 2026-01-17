/* MagicMirror Module: MMM-GoogleDrivePhotos
 * Displays random photos from a Google Drive folder
 */

Module.register("MMM-GoogleDrivePhotos", {
  defaults: {
    folderId: "",
    updateInterval: 30 * 1000,
    transitionSpeed: 2000,
    maxWidth: "100%",
    maxHeight: "100%",
    opacity: 1.0,
    mode: "contain",
    showPhotoInfo: false,
    shuffle: true,
    refreshInterval: 30 * 60 * 1000,
    recursiveSearch: false,
  },

  photos: [],
  currentIndex: 0,
  activeSlot: 0,
  loaded: false,
  domReady: false,

  getStyles: function () {
    return ["MMM-GoogleDrivePhotos.css"];
  },

  start: function () {
    Log.info("Starting module: " + this.name);
    if (!this.config.folderId) {
      Log.error("MMM-GoogleDrivePhotos: folderId is required!");
      return;
    }
    this.sendSocketNotification("INIT", this.config);
  },

  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.className = "mmm-gdrivephotos-wrapper";

    if (!this.loaded) {
      wrapper.innerHTML = '<div class="mmm-gdrivephotos-loading">Loading photos...</div>';
      return wrapper;
    }

    if (this.photos.length === 0) {
      wrapper.innerHTML = '<div class="mmm-gdrivephotos-error">No photos found</div>';
      return wrapper;
    }

    // Create two image slots for crossfade
    for (let i = 0; i < 2; i++) {
      const slot = document.createElement("div");
      slot.className = "mmm-gdrivephotos-slot slot-" + i;
      slot.style.opacity = i === 0 ? 1 : 0;
      
      const img = document.createElement("img");
      img.className = "mmm-gdrivephotos-image";
      img.style.objectFit = this.config.mode;
      img.style.maxWidth = this.config.maxWidth;
      img.style.maxHeight = this.config.maxHeight;
      img.style.opacity = this.config.opacity;
      
      slot.appendChild(img);
      wrapper.appendChild(slot);
    }

    if (this.config.showPhotoInfo) {
      const info = document.createElement("div");
      info.className = "mmm-gdrivephotos-info";
      wrapper.appendChild(info);
    }

    this.domReady = true;
    return wrapper;
  },

  socketNotificationReceived: function (notification, payload) {
    Log.info("MMM-GoogleDrivePhotos: Received " + notification);
    
    if (notification === "PHOTOS_LOADED") {
      Log.info("MMM-GoogleDrivePhotos: Loaded " + payload.length + " photos");
      this.photos = payload;
      
      if (this.config.shuffle) {
        this.shufflePhotos();
      }
      
      this.loaded = true;
      this.currentIndex = 0;
      this.updateDom();
      
      // Wait for DOM to be ready, then start slideshow
      setTimeout(() => {
        this.showNextPhoto();
        this.scheduleNextPhoto();
      }, 2000);
    }
    
    if (notification === "PHOTO_DATA") {
      Log.info("MMM-GoogleDrivePhotos: Received photo URL");
      this.displayPhoto(payload);
    }
    
    if (notification === "ERROR") {
      Log.error("MMM-GoogleDrivePhotos: " + payload);
    }
  },

  shufflePhotos: function () {
    for (let i = this.photos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.photos[i], this.photos[j]] = [this.photos[j], this.photos[i]];
    }
  },

  showNextPhoto: function () {
    if (this.photos.length === 0) return;
    
    const photo = this.photos[this.currentIndex];
    Log.info("MMM-GoogleDrivePhotos: Requesting photo " + this.currentIndex + ": " + photo.name);
    
    this.sendSocketNotification("GET_PHOTO", {
      photo: photo,
      width: window.innerWidth || 1920,
      height: window.innerHeight || 1080,
    });

    this.currentIndex = (this.currentIndex + 1) % this.photos.length;
    
    if (this.currentIndex === 0 && this.config.shuffle) {
      this.shufflePhotos();
    }
  },

  displayPhoto: function (photoData) {
    const slots = document.querySelectorAll(".mmm-gdrivephotos-slot");
    
    if (slots.length < 2) {
      Log.error("MMM-GoogleDrivePhotos: Slots not found, retrying...");
      setTimeout(() => this.displayPhoto(photoData), 500);
      return;
    }

    const nextSlot = 1 - this.activeSlot;
    const nextImg = slots[nextSlot].querySelector("img");
    
    if (!nextImg) {
      Log.error("MMM-GoogleDrivePhotos: Image element not found");
      return;
    }

    Log.info("MMM-GoogleDrivePhotos: Loading image into slot " + nextSlot);

    nextImg.onload = () => {
      Log.info("MMM-GoogleDrivePhotos: Image loaded successfully");
      slots[this.activeSlot].style.opacity = 0;
      slots[nextSlot].style.opacity = 1;
      this.activeSlot = nextSlot;
    };

    nextImg.onerror = (e) => {
      Log.error("MMM-GoogleDrivePhotos: Failed to load image: " + photoData.url);
      setTimeout(() => this.showNextPhoto(), 2000);
    };

    nextImg.src = photoData.url;
  },

  scheduleNextPhoto: function () {
    setInterval(() => {
      this.showNextPhoto();
    }, this.config.updateInterval);
  },
});
