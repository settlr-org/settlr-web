"use client";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import type { LoadFailure } from "../lib/errors";
import {
  CloseOutlined,
  InboxOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

type ConfirmationOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
};

type PendingConfirmation = ConfirmationOptions & {
  resolve: (confirmed: boolean) => void;
};

const ConfirmationContext = createContext<
  ((options: ConfirmationOptions) => Promise<boolean>) | undefined
>(undefined);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation>();
  const requestConfirmation = useCallback(
    (options: ConfirmationOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );
  const close = (confirmed: boolean) => {
    if (!pending) return;
    pending.resolve(confirmed);
    setPending(undefined);
  };

  return (
    <ConfirmationContext.Provider value={requestConfirmation}>
      {children}
      {pending && (
        <Modal
          title={pending.title}
          subtitle={pending.description}
          onClose={() => close(false)}
        >
          <div className="modal-actions">
            <button className="button full" onClick={() => close(false)}>
              Cancel
            </button>
            <button
              className={
                pending.danger ? "button danger full" : "button primary full"
              }
              onClick={() => close(true)}
            >
              {pending.confirmLabel || "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const requestConfirmation = useContext(ConfirmationContext);
  if (!requestConfirmation)
    throw new Error("useConfirmation must be used inside ConfirmationProvider");
  return requestConfirmation;
}
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function PanelTitle({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        {meta && <p>{meta}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  text,
  icon = <InboxOutlined />,
  action,
}: {
  title?: string;
  text: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="alert" role="alert">
      <span>{message}</span>
      {retry && (
        <button onClick={retry}>
          <ReloadOutlined /> Try again
        </button>
      )}
    </div>
  );
}
/**
 * Full replacement for a view whose data failed to load. Shows only the
 * error (never zeros or an empty state that would look like real data). A
 * missing or forbidden record gets a way back instead of a pointless retry.
 */
export function LoadError({
  failure,
  retry,
  backHref,
  backLabel = "Go back",
}: {
  failure: LoadFailure;
  retry?: () => void;
  backHref?: string;
  backLabel?: string;
}) {
  if (failure.kind === "missing")
    return (
      <div className="empty load-error" role="alert">
        <InboxOutlined />
        <strong>{failure.status === 403 ? "No access" : "Not found"}</strong>
        <p>{failure.message}</p>
        {backHref && (
          <Link className="button primary" href={backHref}>
            {backLabel}
          </Link>
        )}
      </div>
    );
  return <ErrorState message={failure.message} retry={retry} />;
}
export function Loading() {
  return (
    <div className="loading">
      <span />
      <span />
      <span />
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const subtitleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    // A field marked data-autofocus (e.g. an amount input) gets focus first.
    const preferred = dialog?.querySelector<HTMLElement>("[data-autofocus]");
    (preferred ?? focusable()[0])?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className={wide ? "modal modal-wide" : "modal"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <CloseOutlined />
        </button>
        <p className="eyebrow">SETTLR</p>
        <h2 id={titleId}>{title}</h2>
        <p id={subtitleId} className="modal-copy">
          {subtitle}
        </p>
        {children}
      </section>
    </div>
  );
}
