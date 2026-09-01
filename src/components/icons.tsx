export function IconPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 4.5v15M4.5 12h15" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

export function IconSliders({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M5 7h14M5 17h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="9" cy="7" r="2.6" fill="currentColor" />
      <circle cx="16" cy="17" r="2.6" fill="currentColor" />
    </svg>
  );
}

export function IconRefresh({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M20 4.5v6h-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBack({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M15.5 4.5 7 12l8.5 7.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSend({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M4.2 11.2 20 4.4c.7-.3 1.4.4 1.1 1.1l-6.8 15.8c-.3.8-1.4.8-1.7 0l-2.4-6.4-6.4-2.4c-.8-.3-.8-1.4 0-1.7Z" />
    </svg>
  );
}

export function IconPeople({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="9" cy="8" r="3.1" stroke="currentColor" strokeWidth="2.2" />
      <path d="M3.8 18.5c.6-3 2.8-4.6 5.2-4.6s4.6 1.6 5.2 4.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16.5" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="2.2" />
      <path d="M15.2 14.2c2.1-.2 4.1 1.1 4.8 3.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconBell({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3.5c-3.2 0-5.8 2.5-5.8 5.6v2.2c0 .8-.3 1.6-.9 2.2l-.8.8c-.7.7-.2 1.9.8 1.9h13.4c1 0 1.5-1.2.8-1.9l-.8-.8c-.6-.6-.9-1.4-.9-2.2V9.1c0-3.1-2.6-5.6-5.8-5.6Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M10 19c.4.9 1.1 1.4 2 1.4s1.6-.5 2-1.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconClose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}
