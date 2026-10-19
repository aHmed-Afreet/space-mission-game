// Register only production builds. Browser play remains available without installation.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(new URL("sw.js", document.baseURI))
      .catch(() => {
        /* Offline installation is optional; online gameplay still works. */
      });
  });
}
