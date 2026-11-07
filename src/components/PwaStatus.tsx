import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function PwaStatus({ pendingChanges }: { pendingChanges: number }) {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(
    undefined,
  );
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [error, setError] = useState(false);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [refresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () => setError(true),
    onRegisteredSW: (_url, registration) => {
      registrationRef.current = registration;
    },
  });
  useEffect(() => {
    const check = () => {
      if (navigator.onLine && !document.hidden)
        void registrationRef.current?.update().catch(() => {});
    };
    addEventListener("online", check);
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
      document.removeEventListener("visibilitychange", check);
      removeEventListener("beforeinstallprompt", capture);
      removeEventListener("appinstalled", done);
    };
  }, []);
  if (import.meta.env.DEV) return null;
  return (
    <>
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
