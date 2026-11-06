import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  Check,
  Copy,
  House,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  X,
} from "lucide-react";
import type { HouseholdController } from "../hooks/useHousehold";

function ConfirmAction({
  title,
  description,
  button,
  action,
  close,
}: {
  title: string;
  description: string;
  button: string;
  action: () => Promise<boolean>;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} onCancel={close} aria-labelledby="home-confirm-title">
      <div className="dialog-header">
        <h2 id="home-confirm-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Cerrar"
          disabled={busy}
          onClick={close}
        >
          <X />
        </button>
      </div>
      <p className="checkout-description">{description}</p>
      {failed && (
        <p role="alert" className="error">
          No se pudo completar. Cerrá este aviso y revisá el error del hogar.
        </p>
      )}
      <div className="checkout-actions">
        <button autoFocus className="secondary" disabled={busy} onClick={close}>
          Cancelar
        </button>
        <button
          className="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (await action()) close();
            else {
              setBusy(false);
              setFailed(true);
            }
          }}
        >
          {busy ? "Procesando…" : button}
        </button>
      </div>
    </dialog>
  );
}

export function HouseholdSettings({
  cloud,
  onExport,
}: {
  cloud: HouseholdController;
  onExport: () => void;
}) {
  const [name, setName] = useState("Nuestro hogar");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    button: string;
    action: () => Promise<boolean>;
  } | null>(null);
  const isOwner = cloud.user?.uid === cloud.home?.ownerUid;
  function create(e: FormEvent) {
    e.preventDefault();
    void cloud.create(name);
  }
  function join(e: FormEvent) {
    e.preventDefault();
    void cloud.join(code);
  }
  return (
    <section className="inventory settings household-settings">
      <div className="home-card-heading">
        <span className="stat-icon green">
          <House />
        </span>
        <div>
          <h2>{cloud.home?.name ?? "Compartí lo de todos los días"}</h2>
          <p>
            {cloud.id
              ? "Un inventario para todo el hogar."
              : "Invitá a quienes viven con vos para organizarse juntos."}
          </p>
        </div>
      </div>
      {!cloud.configured && (
        <div className="stage-note">
          <b>El modo local sigue listo para usar.</b>
          <p>
            Para conectar varios dispositivos, falta configurar tu proyecto
            gratuito de Firebase. El paso a paso está en el README del proyecto,
            sección “Setup de Firebase sin facturación”.
          </p>
        </div>
      )}
      {cloud.emulatorMode && (
        <div className="stage-note">
          Modo de pruebas local. Estas cuentas y datos son de demostración; no
          se envían a Firebase real.
        </div>
      )}
      {cloud.error && (
        <p role="alert" className="error">
          {cloud.error}
        </p>
      )}
      {cloud.loading && (
        <p role="status" className="stage-note">
          Cargando tu hogar…
        </p>
      )}
      {cloud.configured && !cloud.user && !cloud.loading && (
        <div className="home-signin">
          <p>
            Ingresá con tu cuenta de Google. No tenés que crear otra contraseña.
          </p>
          <button
            className="primary"
            disabled={cloud.pending || !cloud.online}
            onClick={() => void cloud.login()}
          >
            <ShieldCheck size={20} />
            Ingresar con Google
          </button>
        </div>
      )}
      {cloud.user && (
        <>
          <div className="account-line">
            <span>
              <b>{cloud.user.displayName || "Tu cuenta"}</b>
              <small>{cloud.user.email}</small>
            </span>
            <button
              className="secondary"
              disabled={cloud.pending}
              onClick={() =>
                setConfirm({
                  title: "¿Cerramos la sesión?",
                  description:
                    "Se van a borrar los datos de esta app guardados en este navegador, incluido el inventario local. El hogar compartido sigue en Firebase. Exportá un respaldo antes si querés conservar la copia local.",
                  button: "Cerrar sesión",
                  action: cloud.logout,
                })
              }
            >
              <LogOut size={16} />
              Salir
            </button>
          </div>
          {!cloud.id && !cloud.loading && (
            <div className="home-setup-grid">
              <form onSubmit={create}>
                <h3>Creá tu hogar</h3>
                <p>
                  Vas a ser el propietario y podrás invitar a otros integrantes.
                </p>
                <label>
                  Nombre del hogar
                  <input
                    value={name}
                    maxLength={80}
                    required
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button
                  className="primary full"
                  disabled={cloud.pending || !cloud.online}
                >
                  Crear hogar
                </button>
              </form>
              <form onSubmit={join}>
                <h3>Sumate a un hogar</h3>
                <p>
                  Pedile el código de invitación al propietario. Dura 48 horas.
                </p>
                <label>
                  Código de invitación
                  <input
                    value={code}
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={32}
                    minLength={32}
                    onChange={(e) => setCode(e.target.value.trim())}
                    placeholder="Pegá el código de 32 caracteres"
                  />
                </label>
                <button
                  className="secondary full"
                  disabled={cloud.pending || !cloud.online}
                >
                  Unirme al hogar
                </button>
              </form>
            </div>
          )}
          {cloud.home && cloud.ready && (
            <>
              <div className="home-security">
                <ShieldCheck size={18} />
                <span>
                  {isOwner
                    ? "Sos propietario de este hogar"
                    : "Sos integrante de este hogar"}
                </span>
              </div>
              {isOwner && (
                <div className="invite-panel">
                  <h3>Invitá a alguien</h3>
                  <p>Compartí este código solo con integrantes de tu casa.</p>
                  <code>{cloud.home.inviteCode}</code>
                  <small>
                    Vence el{" "}
                    {cloud.home.inviteExpiresAt
                      .toDate()
                      .toLocaleString("es-AR")}
                    .
                  </small>
                  <div className="invite-actions">
                    <button
                      className="secondary"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            cloud.home!.inviteCode,
                          );
                          setCopied(true);
                        } catch {
                          setCopied(false);
                        }
                      }}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                      {copied ? "Copiado" : "Copiar código"}
                    </button>
                    <button
                      className="secondary"
                      disabled={cloud.pending || !cloud.online}
                      onClick={() =>
                        setConfirm({
                          title: "¿Renovamos el código?",
                          description:
                            "El código anterior va a dejar de funcionar. Las personas que ya son integrantes seguirán en el hogar.",
                          button: "Renovar código",
                          action: async () => {
                            setCopied(false);
                            return cloud.rotate();
                          },
                        })
                      }
                    >
                      <RefreshCw size={16} />
                      Renovar
                    </button>
                  </div>
                </div>
              )}
              <h3>Integrantes</h3>
              <div className="members-list">
                {cloud.members.map((m) => (
                  <div key={m.uid}>
                    <span>
                      <b>
                        {m.displayName}
                        {m.uid === cloud.user?.uid ? " (vos)" : ""}
                      </b>
                      <small>
                        {m.role === "owner" ? "Propietario" : "Integrante"}
                      </small>
                    </span>
                    {isOwner && m.role !== "owner" && (
                      <button
                        className="icon-button"
                        disabled={cloud.pending || !cloud.online}
                        aria-label={`Expulsar a ${m.displayName}`}
                        onClick={() =>
                          setConfirm({
                            title: `¿Quitamos a ${m.displayName}?`,
                            description:
                              "Va a perder el acceso al hogar. También renovamos el código para que la invitación anterior deje de funcionar.",
                            button: "Quitar integrante",
                            action: () => cloud.expel(m.uid),
                          })
                        }
                      >
                        <UserMinus size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!cloud.port?.state.products.length &&
                !cloud.port?.state.manualItems.length && (
                  <div className="stage-note">
                    <h3>Traé tu inventario local</h3>
                    <p>
                      Solo se puede importar a un hogar vacío. No se sube nada
                      automáticamente.
                    </p>
                    <button
                      className="secondary"
                      disabled={cloud.pending}
                      onClick={() => cloud.importLocal()}
                    >
                      Importar datos de este navegador
                    </button>
                  </div>
                )}
              {isOwner && (
                <div className="home-danger">
                  <h3>Desactivar hogar</h3>
                  <p>
                    Se bloquea el acceso de todos los integrantes. Los registros
                    quedan retenidos en Firebase; el README explica cómo
                    borrarlos definitivamente desde la consola.
                  </p>
                  <button
                    className="danger"
                    disabled={cloud.pending || !cloud.online}
                    onClick={() =>
                      setConfirm({
                        title: "¿Desactivamos este hogar?",
                        description:
                          "Todos van a perder acceso al inventario y a la lista. Esta app no permite reactivar el hogar. Exportá un respaldo antes si querés conservar sus datos.",
                        button: "Desactivar hogar",
                        action: cloud.deactivate,
                      })
                    }
                  >
                    Desactivar hogar
                  </button>
                </div>
              )}
            </>
          )}
          {cloud.id && !cloud.loading && !cloud.ready && (
            <button
              className="secondary"
              disabled={cloud.pending && cloud.ready}
              onClick={() => void cloud.localMode()}
            >
              Volver al inventario local
            </button>
          )}
        </>
      )}
      <h3>Respaldo de tus datos</h3>
      <p>
        Descargá una copia del inventario y la lista. La restauración desde la
        app se agregará más adelante.
      </p>
      <button className="secondary" onClick={onExport}>
        <ArrowDownToLine size={18} />
        Exportar respaldo
      </button>
      <p className="home-note">
        {cloud.id
          ? "La edición compartida necesita conexión en esta etapa. La PWA y el guardado offline llegan en la próxima."
          : "Sin un hogar conectado, tus datos quedan en este navegador."}
      </p>
      {confirm && <ConfirmAction {...confirm} close={() => setConfirm(null)} />}
    </section>
  );
}
