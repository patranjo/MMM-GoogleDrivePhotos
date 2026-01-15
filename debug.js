#!/usr/bin/env node
/* Debug script to test Google Drive API access */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const TOKEN_PATH = path.join(__dirname, "token.json");
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");

async function debug() {
  console.log("\n🔍 Debugging Google Drive API Access\n");
  console.log("=".repeat(60));

  // Check files exist
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.log("❌ credentials.json not found");
    return;
  }
  console.log("✓ credentials.json found");

  if (!fs.existsSync(TOKEN_PATH)) {
    console.log("❌ token.json not found - run 'npm run auth' first");
    return;
  }
  console.log("✓ token.json found");

  // Load credentials and token
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));

  console.log("\n📋 Token info:");
  console.log("   Scope:", token.scope || "not set");
  console.log("   Expiry:", token.expiry_date ? new Date(token.expiry_date).toISOString() : "not set");

  // Check if correct scope is present
  if (!token.scope || !token.scope.includes("drive")) {
    console.log("\n⚠️  WARNING: Token does not have drive scope!");
    console.log("   Delete token.json and run 'npm run auth' again");
  }

  // Set up OAuth client
  const { client_secret, client_id } = credentials.installed || credentials.web;
  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, "http://localhost:1");
  oauth2Client.setCredentials(token);

  // Try to get access token
  console.log("\n🔑 Testing token refresh...");
  try {
    await oauth2Client.getAccessToken();
    console.log("✓ Access token obtained");

    // Test the API
    console.log("\n📡 Testing Google Drive API...");
    
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    
    // Test 1: Get user info
    const aboutResponse = await drive.about.get({ fields: "user" });
    console.log("✓ API connection successful!");
    console.log("   Logged in as:", aboutResponse.data.user.displayName || aboutResponse.data.user.emailAddress);

    // Test 2: List some files
    console.log("\n📂 Listing files...");
    const filesResponse = await drive.files.list({
      pageSize: 5,
      fields: "files(id, name, mimeType)",
    });

    if (filesResponse.data.files && filesResponse.data.files.length > 0) {
      console.log("✓ Found files:");
      filesResponse.data.files.forEach(file => {
        console.log(`   - ${file.name} (${file.mimeType})`);
      });
    } else {
      console.log("   No files found (Drive may be empty)");
    }

    // Test 3: List image files
    console.log("\n🖼️  Looking for images...");
    const imageResponse = await drive.files.list({
      q: "mimeType contains 'image/'",
      pageSize: 5,
      fields: "files(id, name, mimeType)",
    });

    if (imageResponse.data.files && imageResponse.data.files.length > 0) {
      console.log("✓ Found images:");
      imageResponse.data.files.forEach(file => {
        console.log(`   - ${file.name}`);
      });
    } else {
      console.log("   No images found in Drive");
    }

  } catch (error) {
    console.log("❌ Error:", error.message);
    if (error.response) {
      console.log("   Status:", error.response.status);
      console.log("   Data:", JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

debug();
