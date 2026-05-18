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
      setUser(authUser);
      if (authUser) {
        const docRef = doc(db, 'users', authUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
           // If user exists in Auth but not in Firestore, maybe it's the master being initialized
           if (authUser.email === `master${DOMAIN}`) {
             const masterProfile: UserProfile = {
               uid: authUser.uid,
               username: 'master',
               displayName: 'Administrador Master',
               role: 'master',
               status: 'active'
             };
             await setDoc(docRef, masterProfile);
             setProfile(masterProfile);
           }
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
    // Firebase Auth requires at least 6 characters for passwords.
    // We'll pad internally if needed to satisfy the SDK while keeping user input as is.
    const authPass = pass.length < 6 ? pass.padEnd(6, '0') : pass;
    
    console.log(`Tentativa de login: ${cleanUsername} (${email})`);

    // Special case for Master initialization
    if (cleanUsername === 'master' && pass === '4049') {
      try {
        await signInWithEmailAndPassword(auth, email, authPass);
        return;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          console.log('Master não encontrado no Auth, a criar...');
          try {
            await createUserWithEmailAndPassword(auth, email, authPass);
            return;
          } catch (createErr: any) {
            console.error('Erro ao criar Master:', createErr);
            throw createErr;
          }
        }
        throw err;
      }
    }

    try {
      await signInWithEmailAndPassword(auth, email, authPass);
    } catch (err: any) {
      console.log('Login falhou no Auth, a verificar base de dados local...', err.code);
      // If user doesn't exist in Auth, check if they exist in Firestore with this password
      const q = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const userData = snap.docs[0].data() as UserProfile;
        if (userData.password === pass) {
          console.log('Utilizador encontrado na BD local, a registar no Auth...');
          // If password matches, create the Auth user now
          await createUserWithEmailAndPassword(auth, email, authPass);
          return;
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

  const isMaster = profile?.role === 'master' || profile?.username === 'master';

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
