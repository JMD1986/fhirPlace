import { createContext, useContext, useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
export type UserRole = "patient" | "provider";

export interface AppUser {
  username: string;
  email: string;
  createdAt: string;
  role: UserRole;
  /** FHIR Patient UUID linked to this account (patient role only) */
  linkedPatientId?: string;
}

interface StoredUser extends AppUser {
  passwordHash: string;
}

interface AuthContextValue {
  user: AppUser | null;
  login: (email: string, password: string) => string | null;
  signup: (
    username: string,
    email: string,
    password: string,
    role: UserRole,
    linkedPatientId?: string,
  ) => string | null;
  updateUser: (
    updates: Partial<Pick<AppUser, "linkedPatientId" | "role">>,
  ) => void;
  logout: () => void;
}

// ── Simple hash (not cryptographic – fine for localStorage demo) ────────────────
const hashPassword = (pw: string): string => {
  let h = 0;
  for (let i = 0; i < pw.length; i++) {
    h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0;
  }
  return h.toString(16);
};

const USERS_KEY = "fhirPlace_users";
const SESSION_KEY = "fhirPlace_session";

const getStoredUsers = (): StoredUser[] => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]");
  } catch {
    return [];
  }
};

const saveStoredUsers = (users: StoredUser[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

// ── Context ────────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [user]);

  const signup = (
    username: string,
    email: string,
    password: string,
    role: UserRole = "provider",
    linkedPatientId?: string,
  ): string | null => {
    if (!username.trim()) return "Username is required.";
    if (!email.includes("@")) return "Enter a valid email address.";
    if (password.length < 6) return "Password must be at least 6 characters.";

    const users = getStoredUsers();
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return "An account with that email already exists.";
    }

    const newUser: StoredUser = {
      username: username.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      role,
      linkedPatientId,
    };

    saveStoredUsers([...users, newUser]);

    const session: AppUser = {
      username: newUser.username,
      email: newUser.email,
      createdAt: newUser.createdAt,
      role: newUser.role,
      linkedPatientId: newUser.linkedPatientId,
    };
    setUser(session);
    return null;
  };

  const login = (email: string, password: string): string | null => {
    const users = getStoredUsers();
    const match = users.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase().trim() &&
        u.passwordHash === hashPassword(password),
    );
    if (!match) return "Invalid email or password.";

    const session: AppUser = {
      username: match.username,
      email: match.email,
      createdAt: match.createdAt,
      role: match.role ?? "provider",
      linkedPatientId: match.linkedPatientId,
    };
    setUser(session);
    return null;
  };

  const updateUser = (
    updates: Partial<Pick<AppUser, "linkedPatientId" | "role">>,
  ) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      // also persist into the stored users list
      const users = getStoredUsers();
      const idx = users.findIndex(
        (u) => u.email.toLowerCase() === prev.email.toLowerCase(),
      );
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updates };
        saveStoredUsers(users);
      }
      return updated;
    });
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, signup, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
