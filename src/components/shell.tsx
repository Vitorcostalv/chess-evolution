"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ArrowUpRight, Hexagon } from "lucide-react";
import { useLab } from "@/stores/lab";
import { usePreferences } from "@/stores/preferences";
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  useEffect(() => {
    void usePreferences.getState().load();
    void useLab.getState().refresh();
    const visibility = () => {
      if (
        document.hidden &&
        usePreferences.getState().value.autoPause &&
        useLab.getState().busy
      )
        useLab.getState().pause();
    };
    const unload = () => useLab.getState().terminate();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("beforeunload", unload);
    };
  }, []);
  return (
    <>
      <header className="header">
        <Link href="/" className="brand">
          <Hexagon size={26} strokeWidth={1.2} />
          <span>
            CHESS <b>{"//"}</b> EVOLUTION
            <small>AN INTELLIGENCE IN PROGRESS</small>
          </span>
        </Link>
        <nav aria-label="Navegação principal">
          {[
            ["/", "Arena"],
            ["/lab", "Neural Lab"],
            ["/tournaments", "Torneios"],
            ["/models", "Modelos"],
            ["/games", "Partidas"],
            ["/settings", "Ajustes"],
          ].map(([url, name]) => (
            <Link key={url} href={url} className={path === url ? "active" : ""}>
              {name}
            </Link>
          ))}
        </nav>
        <a
          className="source"
          href="https://github.com/Vitorcostalv/chess-evolution"
          target="_blank"
          rel="noreferrer"
        >
          Open source <ArrowUpRight size={15} />
        </a>
      </header>
      <main>{children}</main>
      <footer>
        <span>
          {"CHESS // EVOLUTION"} <i>© 2026</i>
        </span>
        <span>Local-first. Uma jogada de cada vez.</span>
        <span className="status-dot">Motor no seu dispositivo</span>
      </footer>
    </>
  );
}
