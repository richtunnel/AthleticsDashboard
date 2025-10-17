"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface Notification {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  timestamp: Date;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (message: string, type: Notification["type"]) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (message: string, type: Notification["type"]) => {
    const id = `${Date.now()}-${Math.random()}`;
    const notification: Notification = {
      id,
      message,
      type,
      timestamp: new Date(),
    };
    setNotifications((prev) => [notification, ...prev]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, clearNotifications }}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
