import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { queryClient } from "@/lib/query-client";
import { router } from "@/router";
import "./index.css";

/** Fades out the boot screen in index.html as soon as the app renders, with a short fade. */
const dismissBoot = () => {
  const boot = document.getElementById("boot");
  if (!boot) return;
  requestAnimationFrame(() => {
    boot.classList.add("done");
    boot.removeAttribute("role");
    setTimeout(() => boot.remove(), 150);
  });
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

dismissBoot();
