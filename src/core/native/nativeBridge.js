function unsupported() {
  return { ok: false, error: "Native bridge unavailable." };
}

export async function windowMinimize() {
  if (!window.goodOldLauncher?.windowMinimize) {
    return unsupported();
  }

  return window.goodOldLauncher.windowMinimize();
}

export async function windowToggleMaximize() {
  if (!window.goodOldLauncher?.windowToggleMaximize) {
    return unsupported();
  }

  return window.goodOldLauncher.windowToggleMaximize();
}

export async function windowIsMaximized() {
  if (!window.goodOldLauncher?.windowIsMaximized) {
    return unsupported();
  }

  return window.goodOldLauncher.windowIsMaximized();
}

export async function windowClose() {
  if (!window.goodOldLauncher?.windowClose) {
    return unsupported();
  }

  return window.goodOldLauncher.windowClose();
}

export async function openGameFolder(game) {
  if (!window.goodOldLauncher?.openGameFolder) {
    return unsupported();
  }

  return window.goodOldLauncher.openGameFolder(game);
}

export async function pickCoverImage() {
  if (!window.goodOldLauncher?.pickCoverImage) {
    return unsupported();
  }

  return window.goodOldLauncher.pickCoverImage();
}

export async function installGame(game) {
  if (!window.goodOldLauncher?.installGame) {
    return unsupported();
  }

  return window.goodOldLauncher.installGame(game);
}

export async function uninstallGame(game) {
  if (!window.goodOldLauncher?.uninstallGame) {
    return unsupported();
  }

  return window.goodOldLauncher.uninstallGame(game);
}

export async function loginService(serviceName) {
  if (!window.goodOldLauncher?.loginService) {
    return unsupported();
  }

  return window.goodOldLauncher.loginService(serviceName);
}

export async function logoutService(serviceName) {
  if (!window.goodOldLauncher?.logoutService) {
    return unsupported();
  }

  return window.goodOldLauncher.logoutService(serviceName);
}

export async function verifyServiceConnection(serviceName) {
  if (!window.goodOldLauncher?.verifyServiceConnection) {
    return unsupported();
  }

  return window.goodOldLauncher.verifyServiceConnection(serviceName);
}

export async function storeServiceCredential(serviceName, credential) {
  if (!window.goodOldLauncher?.storeServiceCredential) {
    return unsupported();
  }

  return window.goodOldLauncher.storeServiceCredential(serviceName, credential);
}

export async function checkForUpdates() {
  if (!window.goodOldLauncher?.checkForUpdates) {
    return unsupported();
  }

  return window.goodOldLauncher.checkForUpdates();
}

export async function installDownloadedUpdate() {
  if (!window.goodOldLauncher?.installDownloadedUpdate) {
    return unsupported();
  }

  return window.goodOldLauncher.installDownloadedUpdate();
}

export function onUpdateStatus(callback) {
  if (!window.goodOldLauncher?.onUpdateStatus) {
    return () => {};
  }

  return window.goodOldLauncher.onUpdateStatus(callback);
}
