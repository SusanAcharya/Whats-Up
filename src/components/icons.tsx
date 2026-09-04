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

export function IconSettings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconShare({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="18" cy="5" r="2.4" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="6" cy="12" r="2.4" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="18" cy="19" r="2.4" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M8.2 10.8 15.8 6.4M8.2 13.2l7.6 4.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconCards({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect
        x="3.5"
        y="6.5"
        width="13"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path
        d="M8 4.5h10.5A2 2 0 0 1 20.5 6.5v12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconHash({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9 4.5 7.5 19.5M16.5 4.5 15 19.5M4.5 9.5h16M3.5 14.5h16"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconLink({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M10 14a4.5 4.5 0 0 0 6.4.4l2.2-2.2a4.5 4.5 0 0 0-6.4-6.4l-1.3 1.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M14 10a4.5 4.5 0 0 0-6.4-.4L5.4 11.8a4.5 4.5 0 1 0 6.4 6.4l1.2-1.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconChat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v6a3.5 3.5 0 0 1-3.5 3.5H10l-4.2 3.2c-.7.5-1.8 0-1.8-.9V6.5Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
