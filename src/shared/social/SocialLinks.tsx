import { socialProfiles } from "./profiles";

export function SocialLinks() {
  return (
    <nav
      aria-label="International Drift Hub social profiles"
      className="social-links"
    >
      {socialProfiles.map(({ name, url, icon }) => (
        <a
          key={name}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name} (opens in a new tab)`}
        >
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            {icon === "youtube" ? (
              <>
                <rect x="2" y="5" width="20" height="14" rx="4" />
                <path d="m10 8 6 4-6 4z" fill="white" />
              </>
            ) : icon === "tiktok" ? (
              <path d="M14 2h4c0 3 1.5 4.5 4 5v4a10 10 0 0 1-4-1.3V17a7 7 0 1 1-7-7v4a3 3 0 1 0 3 3z" />
            ) : (
              <>
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="17.5" cy="6.5" r="1.3" />
              </>
            )}
          </svg>
        </a>
      ))}
    </nav>
  );
}
