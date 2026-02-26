const https = require("https");
const fs = require("fs");
const path = require("path");

// binary distribution URL from Synthea wiki
const url =
  "https://github.com/synthetichealth/synthea/releases/download/master-branch-latest/synthea-with-dependencies.jar";
const destDir = path.resolve(__dirname, "..", "synthea");
const dest = path.join(destDir, "synthea-with-dependencies.jar");

function downloadJar(downloadUrl = url) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(downloadUrl, (res) => {
        // follow redirects
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return resolve(downloadJar(res.headers.location));
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: status ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

async function main() {
  try {
    // ensure folder exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (fs.existsSync(dest)) {
      console.log("Synthea jar already present at", dest);
      process.exit(0);
    }

    console.log("Downloading Synthea binary...");
    await downloadJar();
    console.log("Download complete:", dest);
    console.log(
      "✅  You can now run `npm run synthea:run` (requires Java 11+).",
    );
  } catch (err) {
    console.error("Failed to download Synthea:", err);
    process.exit(1);
  }
}

main();
