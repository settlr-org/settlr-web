"use client";
import { ReactNode } from "react";
import {
  CloseOutlined,
  InboxOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
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
    <div className="alert">
      <span>{message}</span>
      {retry && (
        <button onClick={retry}>
          <ReloadOutlined /> Try again
        </button>
      )}
    </div>
  );
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
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className={wide ? "modal modal-wide" : "modal"}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <CloseOutlined />
        </button>
        <p className="eyebrow">SETTLR</p>
        <h2>{title}</h2>
        <p className="modal-copy">{subtitle}</p>
        {children}
      </section>
    </div>
  );
}
