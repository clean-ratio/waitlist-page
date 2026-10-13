import { useCallback, useState } from 'react';

const REGISTRATION_KEY = 'waitlist_registered';

function readRegistration(): boolean {
  try {
    return typeof window !== 'undefined'
      && window.localStorage.getItem(REGISTRATION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function useWaitlistRegistration() {
  const [registered, setRegistered] = useState(readRegistration);

  const markRegistered = useCallback(() => {
    try {
      window.localStorage.setItem(REGISTRATION_KEY, 'true');
    } catch {
      // Keep the registration state for this visit if storage is unavailable.
    }
    setRegistered(true);
  }, []);

  return { registered, markRegistered };
}