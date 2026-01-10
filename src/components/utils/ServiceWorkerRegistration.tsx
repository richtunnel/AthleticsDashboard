"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const registerServiceWorker = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/service-worker.js", {
            scope: "/",
          });

          // Handle updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === "installed") {
                  if (navigator.serviceWorker.controller) {
                    // New update available
                    // Service Worker updates are handled automatically
                  } else {
                    // Service Worker installed for the first time
                    // Ready for offline functionality
                  }
                }
              };
            }
          };
        } catch (error) {
          // Service Worker registration failed - app will continue to work without offline support
        }
      };

      registerServiceWorker();

      // Check for updates periodically
      const checkForUpdates = setInterval(() => {
        navigator.serviceWorker.getRegistration().then((registration) => {
          if (registration) {
            registration.update();
          }
        });
      }, 6 * 60 * 60 * 1000); // Check every 6 hours

      return () => clearInterval(checkForUpdates);
    }
  }, []);

  return null;
}