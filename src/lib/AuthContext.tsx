import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  signInWithEmailAndPassword, 
  signOut,
  createUserWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence
} from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db, adminAuth } from './firebase';
import { UserProfile, Role, Company } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  company: Company | null;
  loading: boolean;
  login: (username: string, pass: string) => Promise<void>;
  register: (username: string, pass: string, data: any, onStepChange?: (step: string) => void) => Promise<void>;
  deleteUserAccount: (uid: string) => Promise<void>;
  logout: () => Promise<void>;
  isMaster: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DOMAIN = '@frotas.local';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
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
               const usernameDocRef = doc(db, 'users', username);
               const usernameDocSnap = await getDoc(usernameDocRef);
               if (usernameDocSnap.exists()) {
                 // Migration: copy to UID doc
                 const data = usernameDocSnap.data();
                 await setDoc(docRef, { ...data, uid: authUser.uid });
                 
                 // If the document that matched had a username/ID that is NOT the UID, delete it to keep DB clean
                 if (username !== authUser.uid) {
                   try {
                     await deleteDoc(usernameDocRef);
                     console.log(`Successfully migrated and cleaned up username doc: ${username}`);
                   } catch (delErr) {
                     console.warn('Could not delete old username doc:', delErr);
                   }
                 }
                 
                 docSnap = await getDoc(docRef);
               }
            }
          }

          if (docSnap.exists()) {
            const up = docSnap.data() as UserProfile;
            setProfile(up);
            if (up.companyId) {
              const cRef = doc(db, 'companies', up.companyId);
              const cSnap = await getDoc(cRef);
              if (cSnap.exists()) {
                setCompany({ id: cSnap.id, ...cSnap.data() } as Company);
              }
            }
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
        setCompany(null);
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
    console.log(`Tentativa de login: ${cleanUsername} (${email}) - Pass len: ${pass.length}`);

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
             if (createErr.code === 'auth/email-already-in-use') throw err;
             throw createErr;
          }
        }
        throw err;
      }
    }

    try {
      await signInWithEmailAndPassword(auth, email, authPass);
      console.log('Login Auth com sucesso');
    } catch (err: any) {
      console.log('Login falhou no Auth, verificando Firestore...', err.code);
      
      try {
        const q = query(collection(db, 'users'), where('username', '==', cleanUsername));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const userData = snap.docs[0].data() as UserProfile;
          console.log('Utilizador encontrado no Firestore, comparando passwords...');
          if (userData.password === pass) {
            console.log('Password Firestore correta, tentando criar/recuperar conta Auth...');
            try {
              await createUserWithEmailAndPassword(auth, email, authPass);
              return;
            } catch (createErr: any) {
              if (createErr.code === 'auth/email-already-in-use') {
                // If it exists in Auth but we're here, it means the password in Auth is different from the one in Firestore
                console.warn('Conta já existe no Auth mas com password diferente da BD.');
                throw err;
              }
              throw createErr;
            }
          } else {
            console.warn('Password na BD não coincide.');
          }
        } else {
          console.warn('Utilizador não encontrado na BD.');
        }
      } catch (fsErr) {
        console.warn('Erro ao consultar Firestore para login:', fsErr);
      }
      throw err;
    }
  };

  const register = async (username: string, pass: string, data: any, onStepChange?: (step: string) => void) => {
    if (!username || !pass) throw new Error('Utilizador e palavra-passe são obrigatórios');
    
    const cleanUsername = username.toLowerCase().trim();
    const email = `${cleanUsername}${DOMAIN}`;
    const authPass = pass.length < 6 ? pass.padEnd(6, '0') : pass;
    
    console.log(`Registo: ${cleanUsername} (${email}) - Pass len: ${pass.length}`);
    
    // Check if profile already exists in Firestore to avoid duplicate usernames
    try {
      onStepChange?.('Verificar se o utilizador já existe...');
      const q = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error(`O utilizador "${cleanUsername}" já existe no sistema. Escolha outro nome.`);
      }

      // If a slug is provided, check if it's already taken
      if (data.slug) {
        onStepChange?.('Verificar se o domínio/slug já está em uso...');
        const qSlug = query(collection(db, 'companies'), where('slug', '==', data.slug.toLowerCase()));
        const snapSlug = await getDocs(qSlug);
        if (!snapSlug.empty) {
          throw new Error(`O domínio/slug "${data.slug}" já está em uso por outra empresa.`);
        }
      }
    } catch (err: any) {
      if (err.message?.includes('já existe') || err.message?.includes('em uso')) throw err;
      console.warn('Could not check uniqueness before register:', err);
    }

    try {
      const userProfile: UserProfile = {
        uid: cleanUsername, // Fallback UID initially, will be migrated to authenticating UID on first sign in
        username: cleanUsername,
        password: pass,
        displayName: data.displayName || username,
        role: data.role || 'admin',
        companyId: data.companyId,
        status: 'active',
        createdAt: new Date().toISOString()
      } as any;

      onStepChange?.('Criar perfil do utilizador na Base de Dados...');
      await setDoc(doc(db, 'users', cleanUsername), userProfile);
      console.log('Sucesso Firestore.');
    } catch (err: any) {
      throw err;
    }
  };

  const deleteUserAccount = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const uData = userSnap.data() as UserProfile;
        if (uData.username && uData.password) {
          const email = `${uData.username.toLowerCase().trim()}${DOMAIN}`;
          const authPass = uData.password.length < 6 ? uData.password.padEnd(6, '0') : uData.password;
          
          try {
            console.log(`Tentando eliminar do Auth: ${email}`);
            const credentials = await signInWithEmailAndPassword(adminAuth, email, authPass);
            if (credentials.user) {
              await credentials.user.delete();
              console.log('Utilizador eliminado do Firebase Auth com sucesso.');
            }
          } catch (authErr) {
            console.warn('Não foi possível remover utilizador do Firebase Auth (pode não existir no Auth):', authErr);
          }
        }
      }
      await deleteDoc(userRef);
      console.log('Utilizador desassociado e apagado do Firestore com sucesso.');
    } catch (err: any) {
      console.error('Erro ao eliminar conta:', err);
      throw err;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const isMaster = profile?.role === 'master' || profile?.username === 'master' || user?.email === `master${DOMAIN}`;

  return (
    <AuthContext.Provider value={{ user, profile, company, loading, login, register, deleteUserAccount, logout, isMaster }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
