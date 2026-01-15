#!/usr/bin/env node
/* Google Drive OAuth Authentication Script
 * Run this once to authenticate with Google Drive
 * Usage: node auth.js
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { google } = require("googleapis");

// Only request read-only access to Drive files
const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];
const TOKEN_PATH = path.join(__dirname, "token.json");
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");

async function authenticate() {
  // Check for credentials
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error("\n❌ Error: credentials.json not found!\n");
    console.log("Please follow these steps to create your credentials:\n");
    console.log("1. Go to https://console.cloud.google.com/");
    console.log("2. Create a new project (or select an existing one)");
    console.log("3. Enable the 'Google Drive API'");
    console.log("4. Go to 'Google Auth platform' → 'Clients'");
    console.log("5. Click '+ Create Client' and choose 'Desktop app'");
    console.log("6. Download the JSON file and save it as 'credentials.json' in this folder\n");
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id } = credentials.installed || credentials.web;

  // Use a redirect URI that shows the code directly in the browser
  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    "http://localhost:1"
  );

  // Check for existing token
  if (fs.existsSync(TOKEN_PATH)) {
    console.log("\n✓ Existing token found. Testing validity...\n");
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oauth2Client.setCredentials(token);

    try {
      // Test the token by making a simple API call
      const drive = google.drive({ version: "v3", auth: oauth2Client });
      await drive.about.get({ fields: "user" });
      console.log("✓ Token is valid! You're all set.\n");
      
      // List folders to help user find folder ID
      await listFolders(oauth2Client);
      return;
    } catch (error) {
      console.log("Token expired or invalid. Re-authenticating...\n");
    }
  }

  // Generate new token
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("\n" + "=".repeat(60));
  console.log("🔐 Google Drive Authentication");
  console.log("=".repeat(60));
  console.log("\nStep 1: Open this URL in your web browser:\n");
  console.log(authUrl);
  console.log("\nStep 2: Sign in with your Google account");
  console.log("\nStep 3: Click 'Allow' to grant access to your Drive");
  console.log("\nStep 4: You'll see an error page - THIS IS NORMAL!");
  console.log("        Look at the URL bar. It will look like:");
  console.log("        http://localhost:1/?code=XXXX&scope=...");
  console.log("\nStep 5: Copy the code from the URL (the part after 'code=' and before '&')");
  console.log("        and paste it below.\n");
  console.log("=".repeat(60) + "\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Paste the authorization code here: ", async (code) => {
    rl.close();

    // Clean up the code
    code = code.trim();
    if (code.includes("code=")) {
      code = code.split("code=")[1].split("&")[0];
    }
    code = decodeURIComponent(code);

    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Save the token
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log("\n✓ Authentication successful! Token saved.\n");

      // List folders
      await listFolders(oauth2Client);
    } catch (error) {
      console.error("\n❌ Error getting token:", error.message);
      console.log("\nTroubleshooting tips:");
      console.log("- Make sure you copied the entire code from the URL");
      console.log("- The code is between 'code=' and '&scope'");
      console.log("- The code can only be used once - if it fails, start over");
      console.log("- Check that your credentials.json is correct\n");
      process.exit(1);
    }
  });
}

async function listFolders(auth) {
  const drive = google.drive({ version: "v3", auth });
  
  console.log("📁 Your Google Drive Folders:\n");
  console.log("=".repeat(60));

  try {
    // Get folders from root
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: "files(id, name, parents)",
      pageSize: 50,
      orderBy: "name",
    });

    if (response.data.files && response.data.files.length > 0) {
      // Get root folder info
      const rootFolders = response.data.files.filter(f => !f.parents || f.parents.includes("root") || f.parents.length === 0);
      
      console.log("\n  Root level folders:\n");
      
      for (const folder of response.data.files.slice(0, 20)) {
        console.log(`  📷 Folder: ${folder.name}`);
        console.log(`     ID:     ${folder.id}`);
        console.log("");
      }

      if (response.data.files.length > 20) {
        console.log(`  ... and ${response.data.files.length - 20} more folders`);
      }
    } else {
      console.log("\n  No folders found in your Drive.");
    }

    console.log("\n" + "=".repeat(60));
    console.log("\n📌 To find a specific folder's ID:");
    console.log("   1. Open Google Drive in your browser");
    console.log("   2. Navigate to the folder with your photos");
    console.log("   3. Look at the URL - it will be like:");
    console.log("      https://drive.google.com/drive/folders/FOLDER_ID_HERE");
    console.log("   4. Copy the ID from the URL\n");
    console.log("Then add it to your MagicMirror config.js:\n");
    console.log('   folderId: "YOUR_FOLDER_ID_HERE"\n');
  } catch (error) {
    console.error("Error listing folders:", error.message);
  }
}

// Run authentication
authenticate();
