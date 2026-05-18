import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  signInWithEmailAndPassword, 
  signOut,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Role } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (username: string, pass: string) => Promise<void>;
  register: (username: string, pass: string, data: any) => Promise<void>;
  logout: () => Promise<void>;
  isMaster: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DOMAIN = '@frotas.local';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (authUser) => {
      console.log('Auth state changed:', authUser?.email);
      setUser(authUser);
      if (authUser) {
        try {
          // Find profile by UID or username
          const docRef = doc(db, 'users', authUser.uid);
          let docSnap = await getDoc(docRef);
          
          if (!docSnap.exists()) {
            // Fallback: check if doc exists with username as key (for pre-created users)
            const username = authUser.email?.replace(DOMAIN, '');
            if (username) {
               const q = query(collection(db, 'users'), where('username', '==', username));
               const snap = await getDocs(q);
               if (!snap.empty) {
                 // Migration: copy to UID doc
                 const data = snap.docs[0].data();
                 await setDoc(docRef, { ...data, uid: authUser.uid });
                 docSnap = await getDoc(docRef);
               }
            }
          }

          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
             // Master initialization
             if (authUser.email === `master${DOMAIN}`) {
               const masterProfile: UserProfile = {
                 uid: authUser.uid,
                 username: 'master',
                 displayName: 'Administrador Master',
                 role: 'master',
                 status: 'active'
               };
               try {
                 // Try to persist it, but don't block if rules or network fail initially
                 await setDoc(docRef, masterProfile);
                 console.log('Master profile persisted');
               } catch (masterErr) {
                 console.warn('Could not persist Master profile:', masterErr);
               }
               setProfile(masterProfile);
             }
          }
        } catch (err: any) {
          console.error('Error fetching user profile:', err);
          // If offline, we might still have a partial profile or we just wait
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  const login = async (username: string, pass: string) => {
    const cleanUsername = username.toLowerCase().trim();
    const email = `${cleanUsername}${DOMAIN}`;
    // Use a simpler but valid password for Auth
    // Firebase Auth requires at least 6 characters for passwords.
    // We'll pad internally to satisfy the SDK while keeping user input simple.
    const authPass = pass.length < 6 ? pass.padEnd(6, '0') : pass;
    
    console.log(`Tentativa de login: ${cleanUsername} (${email})`);

    // Special case for Master
    if (cleanUsername === 'master' && pass === '4049') {
      try {
        await signInWithEmailAndPassword(auth, email, authPass);
        return;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
          console.log('Master não autorizado ou não existe, tentando criar...');
          try {
            await createUserWithEmailAndPassword(auth, email, authPass);
            return;
          } catch (createErr: any) {
             // If user already exists but password was wrong, throw original error
             if (createErr.code === 'auth/email-already-in-use') throw err;
             throw createErr;
          }
        }
        throw err;
      }
    }

    try {
      await signInWithEmailAndPassword(auth, email, authPass);
    } catch (err: any) {
      console.log('Login falhou no Auth, verificando Firestore...', err.code);
      const q = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const userData = snap.docs[0].data() as UserProfile;
        // Search for password field (might be missing in newer records)
        if (userData.password === pass) {
          console.log('Utilizador na BD, criando Auth...');
          try {
            await createUserWithEmailAndPassword(auth, email, authPass);
            return;
          } catch (createErr: any) {
            if (createErr.code === 'auth/email-already-in-use') {
              throw err;
            }
            throw createErr;
          }
        }
      }
      throw err;
    }
  };

  const register = async (username: string, pass: string, data: any) => {
    const cleanUsername = username.toLowerCase().trim();
    const email = `${cleanUsername}${DOMAIN}`;
    const authPass = pass.length < 6 ? pass.padEnd(6, '0') : pass;
    
    const { user: authUser } = await createUserWithEmailAndPassword(auth, email, authPass);
    
    const userProfile: UserProfile = {
      uid: authUser.uid,
      username: cleanUsername,
      displayName: data.displayName || username,
      role: data.role || 'admin',
      companyId: data.companyId,
      status: 'active',
      createdAt: new Date().toISOString()
    } as any;

    await setDoc(doc(db, 'users', authUser.uid), userProfile);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const isMaster = profile?.role === 'master' || profile?.username === 'master' || user?.email === `master${DOMAIN}`;

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout, isMaster }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
