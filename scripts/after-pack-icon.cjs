const path = require("node:path");
const { rcedit } = require("rcedit");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, "build", "icon.ico");

  await rcedit(exePath, {
    icon: iconPath
  });

  // eslint-disable-next-line no-console
  console.log(`[afterPack] Patched EXE icon: ${exePath}`);
};
