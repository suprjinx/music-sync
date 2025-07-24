import React from "react";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
}

const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = "info"
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "success": return "✅";
      case "warning": return "⚠️";
      case "error": return "❌";
      default: return "ℹ️";
    }
  };

  const getTypeClass = () => {
    switch (type) {
      case "success": return "notification-success";
      case "warning": return "notification-warning";
      case "error": return "notification-error";
      default: return "notification-info";
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`notification-modal ${getTypeClass()}`} onClick={(e) => e.stopPropagation()}>
        <div className="notification-header">
          <span className="notification-icon">{getIcon()}</span>
          <h3 className="notification-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="notification-content">
          <pre className="notification-message">{message}</pre>
        </div>
        <div className="notification-footer">
          <button className="notification-ok-button" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;