'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

type MenuItem = { label: string; href: string; owner: boolean; freelancer: boolean };

const ITEMS: MenuItem[] = [
  { label: 'Dashboard', href: '/', owner: true, freelancer: true },
  { label: 'Profile', href: '/profile', owner: true, freelancer: true },
  { label: 'Clients', href: '/clients', owner: true, freelancer: true },
  { label: 'Projects', href: '/projects', owner: true, freelancer: true },
  { label: 'Invoices', href: '/invoices', owner: true, freelancer: true },
  { label: 'Outstanding Payments', href: '/outstanding-payments', owner: true, freelancer: true },
  { label: 'Payment Reminders', href: '/payment-reminders', owner: true, freelancer: true },
  { label: 'Expenses', href: '/expenses', owner: true, freelancer: true },
  { label: 'Recurring Bills', href: '/recurring-bills', owner: true, freelancer: true },
  { label: 'Cashflow', href: '/cashflow', owner: true, freelancer: true },
  { label: 'Simulations', href: '/simulations', owner: true, freelancer: false },
  { label: 'Goals', href: '/goals', owner: true, freelancer: false },
  { label: 'Insights', href: '/insights', owner: true, freelancer: false },
  { label: 'Business Setup', href: '/business-setup', owner: true, freelancer: true },
  { label: 'Weekly Business Review', href: '/weekly-business-review', owner: true, freelancer: true },
  { label: 'Tasks & Calendar', href: '/tasks-calendar', owner: true, freelancer: true },
  { label: 'Business Health Score', href: '/business-health-score', owner: true, freelancer: true },
  { label: 'Daily Motivation', href: '/daily-motivation', owner: true, freelancer: true },
  { label: 'Team', href: '/team', owner: true, freelancer: true },
];

const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password'];

function isFreelancer(role?: string): boolean {
  return (role ?? '').toLowerCase().includes('freelance');
}

function isOwner(role?: string): boolean {
  const r = (role ?? '').toLowerCase();
  return r.includes('owner') || r.includes('business');
}

function visibleItems(role?: string): MenuItem[] {
  if (isFreelancer(role)) return ITEMS.filter((i) => i.freelancer);
  if (isOwner(role)) return ITEMS.filter((i) => i.owner);
  return ITEMS;
}

function personaLabel(role?: string): string {
  if (isFreelancer(role)) return 'Freelance Video Editor';
  if (isOwner(role)) return 'Business Owner';
  return '';
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (AUTH_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  const items = visibleItems(user?.role);
  const persona = personaLabel(user?.role);

  const handleSignOut = () => {
    logout();
    router.replace('/login');
  };

  const linkClass = (active: boolean) =>
    `block truncate rounded-[var(--radius)] px-3 py-2 text-sm ${
      active
        ? 'bg-card font-semibold text-foreground'
        : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="ui-root ui-shell min-h-screen w-full max-w-full overflow-x-hidden">
      <aside className="ui-sidebar min-w-0" data-nexen-id="nx-2bffa68a-0">
        <div className="ui-brand flex min-w-0 items-center gap-2 p-3">
          <img
            src="/nexen-logo.png"
            alt=""
            className="h-8 w-8 shrink-0 rounded-[var(--radius)] object-contain"
           data-nexen-id="nx-2bffa68a-1"/>
          <span className="truncate font-semibold" data-nexen-id="nx-2bffa68a-2">BizPilot</span>
          <button
            type="button"
            className="ui-btn ui-btn-ghost ml-auto sm:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="ui-nav"
           data-nexen-id="nx-2bffa68a-3">
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        <nav
          id="ui-nav"
          className={`ui-nav min-w-0 flex-col gap-1 p-2 ${menuOpen ? '!flex' : '!hidden'} sm:!flex`}
         data-nexen-id="nx-2bffa68a-4">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={linkClass(active)}
                onClick={() => setMenuOpen(false)}
               data-nexen-id="nx-2bffa68a-5">
                {item.label}
              </Link>
            );
          })}
          <button data-nexen-component="nx_components_AppShell"
            type="button"
            className="ui-btn ui-btn-secondary mt-2 sm:hidden"
            onClick={handleSignOut}
           data-nexen-id="nx-2bffa68a-6">
            Sign out
          </button>
        </nav>
      </aside>

      <header className="ui-topbar flex min-w-0 items-center justify-end gap-3 p-3" data-nexen-id="nx-2bffa68a-7">
        <div className="ui-user flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 flex-col text-right">
            <span className="truncate text-sm font-semibold" data-nexen-id="nx-2bffa68a-8">{user?.name ?? ''}</span>
            <span className="truncate text-xs text-muted-foreground" data-nexen-id="nx-2bffa68a-9">{persona}</span>
          </div>
          <button type="button" className="ui-btn ui-btn-secondary hidden sm:inline-flex" onClick={handleSignOut} data-nexen-id="nx-2bffa68a-10">
            Sign out
          </button>
        </div>
      </header>

      <main className="ui-content min-w-0 w-full max-w-full" data-nexen-id="nx-2bffa68a-11">{children}</main>
    </div>
  );
}