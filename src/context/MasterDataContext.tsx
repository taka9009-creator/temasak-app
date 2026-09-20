import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface MasterData {
  deviceColors: string[];
  changeMachineColors: string[];
}

const defaultMasterData: MasterData = {
  deviceColors: ['白', '黒', 'シルバー'],
  changeMachineColors: ['白', '黒']
};

interface MasterDataContextType {
  masterData: MasterData;
  updateMasterData: (category: keyof MasterData, newData: string[]) => Promise<void>;
  addItem: (category: keyof MasterData, item: string) => Promise<void>;
  removeItem: (category: keyof MasterData, item: string) => Promise<void>;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

const STORAGE_KEY = 'temasak_master_data';

import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { useAuth } from './AuthContext';

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [masterData, setMasterData] = useState<MasterData>({ deviceColors: [], changeMachineColors: [] });
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setMasterData({ deviceColors: [], changeMachineColors: [] });
      return;
    }

    const mdQuery = query(collection(db, 'master_data'), where('user_id', '==', user.id));
    const unsubscribe = onSnapshot(mdQuery, (snapshot) => {
      const md: MasterData = { deviceColors: [], changeMachineColors: [] };
      snapshot.docs.forEach(docSnap => {
        const row = docSnap.data();
        if (row.category === 'deviceColors') md.deviceColors.push(row.value);
        else if (row.category === 'changeMachineColors') md.changeMachineColors.push(row.value);
      });
      setMasterData(md);
    }, (error) => {
      console.error('Firestore master_data error:', error);
    });

    return () => unsubscribe();
  }, [user]);

  const updateMasterData = async (category: keyof MasterData, newData: string[]) => {
    setMasterData(prev => ({ ...prev, [category]: newData }));
    
    if (user) {
      try {
        // Delete all existing items for category
        const mdQuery = query(
          collection(db, 'master_data'), 
          where('user_id', '==', user.id),
          where('category', '==', category)
        );
        const snapshot = await getDocs(mdQuery);
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => batch.delete(d.ref));
        
        // Insert new items
        newData.forEach(val => {
          const docId = `${category}_${encodeURIComponent(val)}_${user.id}`;
          const docRef = doc(db, 'master_data', docId);
          batch.set(docRef, {
            category,
            value: val,
            user_id: user.id
          });
        });

        await batch.commit();
      } catch (e) {
        console.error('Error updating master data in Firestore:', e);
      }
    }
  };

  const addItem = async (category: keyof MasterData, item: string) => {
    if (!item.trim()) return;
    setMasterData(prev => {
      if (prev[category].includes(item)) return prev;
      return { ...prev, [category]: [...prev[category], item] };
    });

    if (user) {
      try {
        const docId = `${category}_${encodeURIComponent(item)}_${user.id}`;
        const docRef = doc(db, 'master_data', docId);
        await setDoc(docRef, { category, value: item, user_id: user.id });
      } catch (e) {
        console.error('Error adding master data item in Firestore:', e);
      }
    }
  };

  const removeItem = async (category: keyof MasterData, item: string) => {
    setMasterData(prev => ({
      ...prev,
      [category]: prev[category].filter(i => i !== item)
    }));

    if (user) {
      try {
        const docId = `${category}_${encodeURIComponent(item)}_${user.id}`;
        const docRef = doc(db, 'master_data', docId);
        await deleteDoc(docRef);
      } catch (e) {
        console.error('Error removing master data item in Firestore:', e);
      }
    }
  };

  return (
    <MasterDataContext.Provider value={{ masterData, updateMasterData, addItem, removeItem }}>
      {children}
    </MasterDataContext.Provider>
  );
}

export function useMasterData() {
  const context = useContext(MasterDataContext);
  if (context === undefined) {
    throw new Error('useMasterData must be used within a MasterDataProvider');
  }
  return context;
}
