/* Node Helper for MMM-GoogleDrivePhotos
 * Handles Google Drive API authentication and photo retrieval
 */

const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

module.exports = NodeHelper.create({
  config: null,
  oauth2Client: null,
  drive: null,
  photoCache: [],
  tokenPath: null,
  credentialsPath: null,

  start: function () {
    console.log(`Starting node helper for: ${this.name}`);
    this.tokenPath = path.join(__dirname, "token.json");
    this.credentialsPath = path.join(__dirname, "credentials.json");
  },

  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case "INIT":
        this.config = payload;
        this.initializeAuth();
        break;
      case "GET_PHOTO":
        this.getPhotoUrl(payload);
        break;
      case "REFRESH_FOLDER":
        this.config = payload;
        this.fetchFolderPhotos();
        break;
    }
  },

  // Initialize OAuth2 client
  initializeAuth: async function () {
    try {
      // Check for credentials file
      if (!fs.existsSync(this.credentialsPath)) {
        this.sendSocketNotification("ERROR", 
          "credentials.json not found. Please follow the setup instructions in README.md"
        );
        return;
      }

      const credentials = JSON.parse(fs.readFileSync(this.credentialsPath));
      const { client_secret, client_id } = credentials.installed || credentials.web;

      this.oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        "http://localhost:1"
      );

      // Check for existing token
      if (fs.existsSync(this.tokenPath)) {
        const token = JSON.parse(fs.readFileSync(this.tokenPath));
        this.oauth2Client.setCredentials(token);
        
        // Set up token refresh handler
        this.oauth2Client.on("tokens", (tokens) => {
          if (tokens.refresh_token) {
            this.saveToken({ ...token, ...tokens });
          }
        });

        // Initialize Drive API
        this.drive = google.drive({ version: "v3", auth: this.oauth2Client });

        await this.fetchFolderPhotos();
      } else {
        this.sendSocketNotification("ERROR",
          "Not authenticated. Please run 'npm run auth' to authenticate with Google Drive"
        );
      }
    } catch (error) {
      console.error("MMM-GoogleDrivePhotos Auth Error:", error);
      this.sendSocketNotification("ERROR", `Authentication failed: ${error.message}`);
    }
  },

  // Save OAuth token
  saveToken: function (token) {
    fs.writeFileSync(this.tokenPath, JSON.stringify(token, null, 2));
    console.log("MMM-GoogleDrivePhotos: Token saved to", this.tokenPath);
  },

  // Fetch photos from the specified folder
  fetchFolderPhotos: async function () {
    if (!this.drive) {
      this.sendSocketNotification("ERROR", "Not authenticated");
      return;
    }

    try {
      const photos = [];
      let pageToken = null;

      // Image MIME types to look for
      const imageMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/bmp",
        "image/tiff",
      ];

      const mimeQuery = imageMimeTypes.map(m => `mimeType='${m}'`).join(" or ");

      // Build the query
      let query = `'${this.config.folderId}' in parents and (${mimeQuery}) and trashed=false`;

      // Paginate through all photos in the folder
      do {
        const response = await this.drive.files.list({
          q: query,
          fields: "nextPageToken, files(id, name, mimeType, createdTime, modifiedTime, imageMediaMetadata)",
          pageSize: 1000,
          pageToken: pageToken,
          orderBy: "createdTime desc",
        });

        if (response.data.files) {
          photos.push(...response.data.files);
        }

        pageToken = response.data.nextPageToken;
      } while (pageToken);

      // If recursive search is enabled, also search subfolders
      if (this.config.recursiveSearch) {
        const subfolderPhotos = await this.fetchSubfolderPhotos(this.config.folderId, imageMimeTypes);
        photos.push(...subfolderPhotos);
      }

      console.log(`MMM-GoogleDrivePhotos: Found ${photos.length} photos in folder`);
      this.photoCache = photos;
      this.sendSocketNotification("PHOTOS_LOADED", photos);
    } catch (error) {
      console.error("MMM-GoogleDrivePhotos Fetch Error:", error);
      this.sendSocketNotification("ERROR", `Failed to fetch photos: ${error.message}`);
    }
  },

  // Recursively fetch photos from subfolders
  fetchSubfolderPhotos: async function (parentId, imageMimeTypes) {
    const photos = [];

    try {
      // Find all subfolders
      const folderResponse = await this.drive.files.list({
        q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, name)",
        pageSize: 100,
      });

      if (folderResponse.data.files) {
        for (const folder of folderResponse.data.files) {
          // Get photos from this subfolder
          const mimeQuery = imageMimeTypes.map(m => `mimeType='${m}'`).join(" or ");
          const photoResponse = await this.drive.files.list({
            q: `'${folder.id}' in parents and (${mimeQuery}) and trashed=false`,
            fields: "files(id, name, mimeType, createdTime, modifiedTime, imageMediaMetadata)",
            pageSize: 1000,
          });

          if (photoResponse.data.files) {
            photos.push(...photoResponse.data.files);
          }

          // Recursively search this subfolder's subfolders
          const nestedPhotos = await this.fetchSubfolderPhotos(folder.id, imageMimeTypes);
          photos.push(...nestedPhotos);
        }
      }
    } catch (error) {
      console.error("MMM-GoogleDrivePhotos Subfolder Error:", error);
    }

    return photos;
  },

  // Get the download URL for a specific photo
  getPhotoUrl: async function (payload) {
    const { photo, width, height } = payload;

    try {
      // Get file content using the webContentLink or generate a thumbnail
      // For images, we can use the thumbnailLink with custom size
      const response = await this.drive.files.get({
        fileId: photo.id,
        fields: "webContentLink, thumbnailLink",
      });

      let imageUrl;

      if (response.data.thumbnailLink) {
        // Modify thumbnail URL to get larger size
        // Google Drive thumbnail URL format: ...=s220 (size)
        // We can change this to get a larger image
        const maxDimension = Math.max(width, height);
        imageUrl = response.data.thumbnailLink.replace(/=s\d+/, `=s${maxDimension}`);
      } else if (response.data.webContentLink) {
        imageUrl = response.data.webContentLink;
      } else {
        // Fallback: construct direct download URL
        imageUrl = `https://drive.google.com/uc?export=view&id=${photo.id}`;
      }

      this.sendSocketNotification("PHOTO_DATA", {
        url: imageUrl,
        metadata: {
          name: photo.name,
          createdTime: photo.createdTime,
          modifiedTime: photo.modifiedTime,
          imageMediaMetadata: photo.imageMediaMetadata,
        },
      });
    } catch (error) {
      console.error("MMM-GoogleDrivePhotos URL Error:", error);
      // Fallback to direct URL
      this.sendSocketNotification("PHOTO_DATA", {
        url: `https://drive.google.com/uc?export=view&id=${photo.id}`,
        metadata: {
          name: photo.name,
          createdTime: photo.createdTime,
        },
      });
    }
  },
});
