import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function usePwa() {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(
    undefined,
  );
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState("");
  const [error, setError] = useState(false);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [refresh, setRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () => setError(true),
    onRegisteredSW: (_url, registration) => {
      registrationRef.current = registration;
      if (registration?.waiting) setRefresh(true);
      if (navigator.onLine) void registration?.update().catch(() => {});
    },
  });
  useEffect(() => {
    const check = () => {
      if (navigator.onLine && !document.hidden)
        void registrationRef.current?.update().catch(() => {});
    };
    addEventListener("online", check);
    addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", check);
    const capture = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    const done = () => setInstall(null);
    addEventListener("beforeinstallprompt", capture);
    addEventListener("appinstalled", done);
    return () => {
      removeEventListener("online", check);
      removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", check);
      removeEventListener("beforeinstallprompt", capture);
      removeEventListener("appinstalled", done);
    };
  }, []);
  async function checkUpdates() {
    setChecking(true);
    setCheckMessage("");
    try {
      if (!navigator.onLine)
        throw new Error("Conectate a Internet para buscar una actualización.");
      const registration =
        registrationRef.current ??
        (await navigator.serviceWorker?.getRegistration());
      if (!registration)
        throw new Error(
          "Todavía se está preparando la app. Volvé a intentar en unos segundos.",
        );
      await registration.update();
      if (registration.waiting) setRefresh(true);
      setCheckMessage(
        registration.waiting
          ? "Hay una versión nueva: tocá Actualizar app."
          : registration.installing
            ? "Descargando la actualización. Esperá el aviso para actualizar."
            : "La app está al día.",
      );
    } catch (error) {
      setCheckMessage(
        error instanceof Error
          ? error.message
          : "No pudimos buscar actualizaciones. Volvé a intentar con conexión.",
      );
    } finally {
      setChecking(false);
    }
  }
  return {
    install,
    setInstall,
    error,
    offlineReady,
    setOfflineReady,
    refresh,
    updateServiceWorker,
    checking,
    checkMessage,
    checkUpdates,
  };
}
export function PwaStatus({
  pwa,
  pendingChanges,
  showCheck = false,
}: {
  pwa: ReturnType<typeof usePwa>;
  pendingChanges: number;
  showCheck?: boolean;
}) {
  const {
    install,
    setInstall,
    error,
    offlineReady,
    setOfflineReady,
    refresh,
    updateServiceWorker,
    checking,
    checkMessage,
    checkUpdates,
  } = pwa;
  if (import.meta.env.DEV) return null;
  return (
    <>
      {showCheck && (
        <div className="stage-note">
          <button
            className="secondary"
            disabled={checking}
            onClick={() => void checkUpdates()}
          >
            {checking ? "Buscando…" : "Buscar actualizaciones"}
          </button>
          <small className="muted"> Catálogo de 150 productos</small>
          {checkMessage && <p role="status">{checkMessage}</p>}
        </div>
      )}
      {error && (
        <p className="stage-note" role="alert">
          No pudimos preparar el modo offline. Volvé a abrir la app con conexión
          antes de salir.
        </p>
      )}
      {offlineReady && (
        <div className="stage-note" role="status">
          La app ya está lista para abrirse sin conexión.{" "}
          <button className="secondary" onClick={() => setOfflineReady(false)}>
            Entendido
          </button>
        </div>
      )}
      {refresh && (
        <div className="stage-note" role="status">
          Hay una versión nueva.{" "}
          {pendingChanges
            ? "Sincronizá o exportá tus cambios antes de actualizar."
            : "Podés actualizar cuando cierres los formularios abiertos."}
          <button
            className="secondary"
            disabled={pendingChanges > 0}
            onClick={() => void updateServiceWorker(true)}
          >
            Actualizar app
          </button>
        </div>
      )}
      {install && (
        <div className="stage-note">
          Tené En casa a mano en tu pantalla de inicio.{" "}
          <button
            className="secondary"
            onClick={async () => {
              await install.prompt();
              await install.userChoice;
              setInstall(null);
            }}
          >
            Instalar app
          </button>
        </div>
      )}
    </>
  );
}
