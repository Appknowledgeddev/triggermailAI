"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Code2,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  Sun,
} from "lucide-react";
import { accountNavItems, workspaceNavItems } from "@/data/app-data";
import { Logo } from "@/components/logo";
import { createSupabaseBrowserClient, hasSupabaseConfig } from "@/lib/supabase/client";

type AppShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  primaryAction?: string;
  secondaryAction?: string;
  primaryActionHref?: string;
  secondaryActionHref?: string;
  primaryActionOnClick?: () => void;
  primaryActionDisabled?: boolean;
  primaryActionHidden?: boolean;
  secondaryActionHidden?: boolean;
  primaryActionAccessory?: React.ReactNode;
};

type NavUser = {
  name: string;
  email: string;
  avatarUrl: string | null;
  initials: string;
};

const fallbackNavUser: NavUser = {
  name: "Signed in",
  email: "Account active",
  avatarUrl: null,
  initials: "TM",
};

function initialsFromName(name: string, email: string) {
  const source = name && name !== "Signed in" ? name : email;
  const parts = source
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || "TM").toUpperCase();
}

function userFromAuth(user: User | null): NavUser {
  if (!user) {
    return fallbackNavUser;
  }

  const metadata = user.user_metadata || {};
  const email = user.email || "Account active";
  const name = String(metadata.full_name || metadata.name || email.split("@")[0] || "Signed in");
  const avatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;

  return {
    name,
    email,
    avatarUrl,
    initials: initialsFromName(name, email),
  };
}

export function AppShell({
  children,
  primaryAction = "New Flow",
  secondaryAction = "Import Trigger",
  primaryActionHref,
  secondaryActionHref,
  primaryActionOnClick,
  primaryActionDisabled = false,
  primaryActionHidden = false,
  secondaryActionHidden = false,
  primaryActionAccessory,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [navUser, setNavUser] = useState<NavUser>(fallbackNavUser);
  const [authChecked, setAuthChecked] = useState(false);
  const isLight = theme === "light";

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("trigger-mail-ai-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    let mounted = true;
    const supabase = createSupabaseBrowserClient();

    async function loadNavUser(user: User | null) {
      const authUser = userFromAuth(user);

      if (!user) {
        if (mounted) {
          setNavUser(authUser);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) {
        return;
      }

      const name = data?.full_name || authUser.name;
      const avatarUrl = data?.avatar_url || authUser.avatarUrl;

      setNavUser({
        name,
        email: authUser.email,
        avatarUrl,
        initials: initialsFromName(name, authUser.email),
      });
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      void loadNavUser(data.user);
      if (mounted) {
        setAuthChecked(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user) {
        setAuthChecked(false);
        if (event === "SIGNED_OUT") {
          router.replace("/login");
        } else {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
        return;
      }

      void loadNavUser(session.user);
      setAuthChecked(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  const toggleTheme = () => {
    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      window.localStorage.setItem("trigger-mail-ai-theme", nextTheme);
      return nextTheme;
    });
  };

  const handleLogout = async () => {
    if (hasSupabaseConfig()) {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    }

    window.location.href = "/login";
  };

  const navShell = isLight
    ? "border-slate-200 bg-white text-slate-900 shadow-[18px_0_50px_rgba(15,23,42,0.12)]"
    : "border-white/10 bg-[#080d16] text-slate-100 shadow-[18px_0_50px_rgba(0,0,0,0.45)]";
  const navItemBase = isLight ? "text-slate-500 hover:bg-slate-100 hover:text-slate-950" : "text-slate-400 hover:bg-white/[0.07] hover:text-white";
  const navLabel = isLight ? "text-slate-500" : "text-slate-400";
  const topbar = isLight
    ? "border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
    : "border-white/10 bg-[#080d16] shadow-[0_18px_45px_rgba(0,0,0,0.35)]";
  const logoVariant = isLight ? "darkText" : "lightText";
  const secondaryActionClass = isLight
    ? "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
    : "border-white/10 bg-white/[0.04] text-slate-100 hover:bg-white/10";

  if (!authChecked) {
    return (
      <main
        data-theme={theme}
        className={`grid min-h-screen place-items-center px-4 transition-colors duration-300 ${
          isLight
            ? "bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_48%,#ffffff_100%)] text-slate-950"
            : "bg-[linear-gradient(135deg,#05070d_0%,#080d16_48%,#05070d_100%)] text-slate-100"
        }`}
      >
        <section className={`w-full max-w-sm rounded-[10px] border p-5 text-center ${isLight ? "border-slate-200 bg-white" : "border-white/10 bg-white/[0.04]"}`}>
          <Logo variant={logoVariant} className="mx-auto max-w-[190px]" />
          <p className={`mt-4 text-sm ${isLight ? "text-slate-500" : "text-slate-400"}`}>Checking your sign-in...</p>
        </section>
      </main>
    );
  }

  return (
    <main
      data-theme={theme}
      className={`min-h-screen transition-colors duration-300 ${
        isLight
          ? "bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.13),transparent_30%),linear-gradient(135deg,#f8fafc_0%,#eef2ff_48%,#ffffff_100%)] text-slate-950"
          : "bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.18),transparent_28%),linear-gradient(135deg,#05070d_0%,#080d16_48%,#05070d_100%)] text-slate-100"
      }`}
    >
      <div className="min-h-screen">
        <aside
          className={`fixed left-0 top-0 z-40 hidden h-screen overflow-visible border-r p-3 transition-[width,background-color,border-color,color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] lg:block ${navShell}`}
          style={{
            width: sidebarCollapsed ? 64 : 232,
            minWidth: sidebarCollapsed ? 64 : 232,
            maxWidth: sidebarCollapsed ? 64 : 232,
          }}
        >
          <div className={`flex items-center gap-2 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarCollapsed ? "justify-center" : "justify-between"}`}>
            <div className={`min-w-0 overflow-hidden transition-[width,opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarCollapsed ? "w-0 -translate-x-2 opacity-0" : "w-[176px] translate-x-0 opacity-100 delay-100"}`}>
              <Link href="/dashboard" className="block min-w-0 px-1">
                <Logo variant={logoVariant} className="max-w-[190px]" />
              </Link>
            </div>
            <button
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`grid size-9 shrink-0 place-items-center rounded-[8px] border transition ${isLight ? "border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-950" : "border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"}`}
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              type="button"
            >
              <Menu size={18} />
            </button>
          </div>

          <div className="mt-7 flex h-[calc(100vh-88px)] flex-col overflow-y-auto pr-1">
            <nav className="space-y-1">
              <p className={`mb-2 overflow-hidden px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-[height,opacity,transform] duration-300 ease-out ${navLabel} ${sidebarCollapsed ? "h-0 -translate-x-1 opacity-0" : "h-4 translate-x-0 opacity-100 delay-150"}`}>Workspace</p>
              {workspaceNavItems.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center rounded-[7px] px-2.5 py-2 text-[13px] font-medium transition-all duration-300 ${
                      active ? "bg-violet-brand text-white shadow-lg shadow-violet-950/40" : navItemBase
                    } ${sidebarCollapsed ? "justify-center gap-0" : "gap-2.5"
                    }`}
                  >
                    <item.icon size={17} />
                  <span className={`overflow-hidden whitespace-nowrap transition-[width,opacity,transform] duration-300 ease-out ${sidebarCollapsed ? "w-0 translate-x-2 opacity-0" : "w-auto translate-x-0 opacity-100 delay-150"}`}>{item.label}</span>
                  {item.badge && !sidebarCollapsed && <span className="ml-auto rounded-full bg-red-danger px-1.5 py-0.5 text-[10px] font-bold text-white transition-opacity duration-200">{item.badge}</span>}
                    {item.badge && sidebarCollapsed && <span className="absolute ml-7 mt-[-24px] rounded-full bg-red-danger px-1.5 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>}
                    {sidebarCollapsed && (
                      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[7px] border border-white/10 bg-[#111827] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-[0_14px_34px_rgba(0,0,0,0.42)] transition duration-150 group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:translate-x-1 group-focus-visible:opacity-100">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-6 space-y-1">
              <p className={`mb-2 overflow-hidden px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-[height,opacity,transform] duration-300 ease-out ${navLabel} ${sidebarCollapsed ? "h-0 -translate-x-1 opacity-0" : "h-4 translate-x-0 opacity-100 delay-150"}`}>Account</p>
              {accountNavItems.map((item) => {
                const active = pathname.startsWith(item.href);
                if (item.label === "Logout") {
                  return (
                    <button
                      key={item.href}
                      className={`group relative flex w-full items-center rounded-[7px] px-2.5 py-2 text-left text-[13px] font-medium transition-all duration-300 ${navItemBase} ${sidebarCollapsed ? "justify-center gap-0" : "gap-2.5"}`}
                      onClick={handleLogout}
                      type="button"
                    >
                      <item.icon size={17} />
                      <span className={`overflow-hidden whitespace-nowrap transition-[width,opacity,transform] duration-300 ease-out ${sidebarCollapsed ? "w-0 translate-x-2 opacity-0" : "w-auto translate-x-0 opacity-100 delay-150"}`}>{item.label}</span>
                      {sidebarCollapsed && (
                        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[7px] border border-white/10 bg-[#111827] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-[0_14px_34px_rgba(0,0,0,0.42)] transition duration-150 group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:translate-x-1 group-focus-visible:opacity-100">
                          {item.label}
                        </span>
                      )}
                    </button>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center rounded-[7px] px-2.5 py-2 text-[13px] font-medium transition-all duration-300 ${
                      active ? "bg-violet-brand text-white" : navItemBase
                    } ${sidebarCollapsed ? "justify-center gap-0" : "gap-2.5"
                    }`}
                  >
                    <item.icon size={17} />
                  <span className={`overflow-hidden whitespace-nowrap transition-[width,opacity,transform] duration-300 ease-out ${sidebarCollapsed ? "w-0 translate-x-2 opacity-0" : "w-auto translate-x-0 opacity-100 delay-150"}`}>{item.label}</span>
                    {sidebarCollapsed && (
                      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[7px] border border-white/10 bg-[#111827] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-[0_14px_34px_rgba(0,0,0,0.42)] transition duration-150 group-hover:translate-x-1 group-hover:opacity-100 group-focus-visible:translate-x-1 group-focus-visible:opacity-100">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            <div className={`mt-auto overflow-hidden rounded-[8px] border p-3 transition-[max-height,opacity,transform,border-color,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${sidebarCollapsed ? "max-h-0 translate-y-2 border-transparent p-0 opacity-0" : "max-h-48 translate-y-0 opacity-100 delay-100"} ${isLight ? "border-slate-200 bg-slate-50 text-slate-950" : "border-white/10 bg-[#0d1220] text-white"}`}>
                <>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <Logo variant={logoVariant} className="max-w-[136px]" />
                    <MoreHorizontal size={16} className="shrink-0" />
                  </div>
                  <p className="text-[13px] font-semibold">AI credits</p>
                  <p className={`mt-1 text-xs leading-5 ${isLight ? "text-slate-500" : "text-slate-300"}`}>2,480 credits remaining for drafts and summaries.</p>
                  <div className={`mt-4 h-2 rounded-full ${isLight ? "bg-slate-200" : "bg-white/15"}`}>
                    <div className="h-2 w-[64%] rounded-full bg-green-success" />
                  </div>
                </>
              </div>
          </div>
        </aside>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              aria-label="Close navigation overlay"
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileNavOpen(false)}
              type="button"
            />
            <aside className={`relative h-full w-[272px] overflow-y-auto border-r p-3 ${navShell}`}>
              <div className="flex items-center justify-between gap-3">
                <Link href="/dashboard" className="block min-w-0 px-1" onClick={() => setMobileNavOpen(false)}>
                  <Logo variant={logoVariant} className="max-w-[172px]" />
                </Link>
                <button
                  aria-label="Close navigation"
                  className={`grid size-9 shrink-0 place-items-center rounded-full border ${isLight ? "border-slate-200 text-slate-500" : "border-white/10 text-slate-400"}`}
                  onClick={() => setMobileNavOpen(false)}
                  type="button"
                >
                  <Menu size={17} />
                </button>
              </div>

              <nav className="mt-7 space-y-1">
                <p className={`mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${navLabel}`}>Workspace</p>
                {workspaceNavItems.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      className={`flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-[13px] font-medium ${
                        active ? "bg-violet-brand text-white" : navItemBase
                      }`}
                    >
                      <item.icon size={17} />
                      <span>{item.label}</span>
                      {item.badge && <span className="ml-auto rounded-full bg-red-danger px-1.5 py-0.5 text-[10px] font-bold text-white">{item.badge}</span>}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-6 space-y-1">
                <p className={`mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${navLabel}`}>Account</p>
                {accountNavItems.map((item) => {
                  const active = pathname.startsWith(item.href);
                  if (item.label === "Logout") {
                    return (
                      <button
                        key={item.href}
                        onClick={() => {
                          setMobileNavOpen(false);
                          handleLogout();
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-[13px] font-medium ${navItemBase}`}
                        type="button"
                      >
                        <item.icon size={17} />
                        {item.label}
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      className={`flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-[13px] font-medium ${
                        active ? "bg-violet-brand text-white" : navItemBase
                      }`}
                    >
                      <item.icon size={17} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </aside>
          </div>
        )}

        <section className="min-w-0 px-3 pb-4 pt-[72px] sm:px-4 lg:pl-[80px]">
          <header className={`fixed left-0 right-0 top-0 z-30 flex min-h-[58px] items-center gap-2.5 border-b px-3 py-2 transition-colors duration-300 sm:px-4 lg:pl-[80px] ${topbar}`}>
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
                className={`grid size-9 shrink-0 place-items-center rounded-[8px] border lg:hidden ${isLight ? "border-slate-200 text-slate-500" : "border-white/10 text-slate-400"}`}
                onClick={() => setMobileNavOpen((open) => !open)}
                type="button"
              >
                <Menu size={18} />
              </button>
            </div>
            {sidebarCollapsed && (
              <Link href="/dashboard" className="hidden w-[148px] shrink-0 lg:block">
                <Logo variant={logoVariant} />
              </Link>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div className="hidden flex-wrap gap-2 md:flex">
                {primaryActionAccessory}
                {!primaryActionHidden && primaryActionOnClick ? (
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 text-[13px] font-semibold text-white shadow-lg shadow-fuchsia-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={primaryActionDisabled}
                    onClick={primaryActionOnClick}
                    type="button"
                  >
                    <Plus size={15} />
                    {primaryAction}
                  </button>
                ) : !primaryActionHidden && primaryActionHref ? (
                  <Link href={primaryActionHref} className="inline-flex h-9 items-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 text-[13px] font-semibold text-white shadow-lg shadow-fuchsia-950/20 transition hover:brightness-110">
                    <Plus size={15} />
                    {primaryAction}
                  </Link>
                ) : !primaryActionHidden ? (
                  <button className="inline-flex h-9 items-center gap-2 rounded-[7px] bg-gradient-to-r from-violet-brand to-fuchsia-600 px-3 text-[13px] font-semibold text-white shadow-lg shadow-fuchsia-950/20 transition hover:brightness-110" type="button">
                    <Plus size={15} />
                    {primaryAction}
                  </button>
                ) : null}
                {!secondaryActionHidden && secondaryActionHref ? (
                  <Link href={secondaryActionHref} className={`inline-flex h-9 items-center gap-2 rounded-[7px] border px-3 text-[13px] font-semibold transition ${secondaryActionClass}`}>
                    <Code2 size={15} />
                    {secondaryAction}
                  </Link>
                ) : !secondaryActionHidden ? (
                  <button className={`inline-flex h-9 items-center gap-2 rounded-[7px] border px-3 text-[13px] font-semibold transition ${secondaryActionClass}`} type="button">
                    <Code2 size={15} />
                    {secondaryAction}
                  </button>
                ) : null}
              </div>
            <button
              aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
              className={`inline-flex h-9 items-center gap-2 rounded-[7px] border px-2.5 text-[13px] font-semibold transition ${isLight ? "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white"}`}
              onClick={toggleTheme}
              type="button"
            >
              {isLight ? <Moon size={18} /> : <Sun size={18} />}
              <span className="hidden xl:inline">{isLight ? "Dark" : "Light"}</span>
            </button>
            <div className={`flex items-center gap-2.5 rounded-[8px] border py-1 pl-1 pr-2.5 ${isLight ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/[0.04]"}`}>
              {navUser.avatarUrl ? (
                <div
                  aria-hidden="true"
                  className="size-8 rounded-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${navUser.avatarUrl})` }}
                />
              ) : (
                <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-amber-warn via-rose-300 to-violet-brand text-xs font-bold text-white">
                  {navUser.initials}
                </div>
              )}
              <div className="hidden sm:block">
                <p className="max-w-[150px] truncate text-[13px] font-semibold">{navUser.name}</p>
                <p className={`max-w-[170px] truncate text-xs ${isLight ? "text-slate-500" : "text-slate-400"}`}>{navUser.email}</p>
              </div>
            </div>
            </div>
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}
