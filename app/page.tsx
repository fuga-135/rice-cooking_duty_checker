'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays, isWithinInterval, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { db } from './firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, query, limit, serverTimestamp, updateDoc } from 'firebase/firestore';
import Calendar from './components/Calendar';
import { useRouter } from 'next/navigation';
import { Person, DutyHistory } from './types';

type DutyRecord = {
  date: string;
  personId: string;
};

type Absence = {
  personId: string;
  startDate: string;
  endDate: string;
  reason: string;
};

type SharedData = {
  people: Person[];
  currentDuty: string;
  dutyHistory: DutyRecord[];
  absences: Absence[];
  isInitialized: boolean;
};

const initialData: SharedData = {
  people: [
    { id: '1', name: 'あきは' },
    { id: '2', name: 'ことは' },
    { id: '3', name: 'わたる' }
  ],
  currentDuty: '1',
  dutyHistory: [],
  absences: [],
  isInitialized: false,
};

const SHARED_DOC_ID = 'shared_data';

export default function Home() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([
    { id: '1', name: 'あきは' },
    { id: '2', name: 'ことは' },
    { id: '3', name: 'わたる' }
  ]);
  const [dutyHistory, setDutyHistory] = useState<DutyHistory[]>([]);
  const [currentDuty, setCurrentDuty] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<string>('1');
  const [absenceStartDate, setAbsenceStartDate] = useState('');
  const [absenceEndDate, setAbsenceEndDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');

  // 初期データの作成
  const createInitialData = useCallback(async () => {
    try {
      const initialData = {
        people: [
          { id: '1', name: 'Aさん' },
          { id: '2', name: 'Bさん' },
          { id: '3', name: 'Cさん' },
          { id: '4', name: 'Dさん' },
          { id: '5', name: 'Eさん' }
        ],
        dutyHistory: [],
        currentDuty: null,
        lastUpdated: serverTimestamp()
      };

      const docRef = doc(db, 'shared_data', SHARED_DOC_ID);
      await setDoc(docRef, initialData);
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      console.error('初期データの作成に失敗しました:', err);
      setError('初期データの作成に失敗しました。もう一度お試しください。');
      setIsInitialized(false);
    }
  }, []);

  // データの更新
  const updateSharedData = async (updates: Partial<SharedData>) => {
    try {
      const docRef = doc(db, 'shared_data', SHARED_DOC_ID);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        // ドキュメントが存在しない場合は初期データを作成
        await setDoc(docRef, {
          ...createInitialData(),
          ...updates,
          lastUpdated: serverTimestamp()
        });
      } else {
        // 既存のドキュメントを更新
        await updateDoc(docRef, {
          ...updates,
          lastUpdated: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('データの更新に失敗しました:', error);
      throw new Error('データの更新に失敗しました。もう一度お試しください。');
    }
  };

  // データの監視
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      doc(db, 'shared_data', SHARED_DOC_ID),
      (docSnapshot) => {
        if (!isMounted) return;

        try {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            setPeople(data.people || []);
            setDutyHistory(data.dutyHistory || []);
            setCurrentDuty(data.currentDuty || null);
            setIsInitialized(true);
          } else {
            createInitialData();
          }
          setError(null);
        } catch (err) {
          console.error('データの処理中にエラーが発生しました:', err);
          setError('データの読み込みに失敗しました。もう一度お試しください。');
        } finally {
          setIsLoading(false);
        }
      },
      (err) => {
        if (!isMounted) return;
        console.error('データの監視中にエラーが発生しました:', err);
        setError('データの読み込みに失敗しました。もう一度お試しください。');
        setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [createInitialData]);

  // メモ化された値と関数
  const memoizedPeople = useMemo(() => people, [people]);
  const memoizedDutyHistory = useMemo(() => dutyHistory, [dutyHistory]);
  const memoizedCurrentDuty = useMemo(() => currentDuty, [currentDuty]);

  const handleNameChange = useCallback(async (id: string, name: string) => {
    const newPeople = people.map(p => p.id === id ? { ...p, name } : p);
    await updateSharedData({ people: newPeople });
  }, [people, updateSharedData]);

  const isPersonAbsent = useCallback((personId: string) => {
    const today = new Date();
    return people.some(person => 
      person.id === personId &&
      isWithinInterval(today, {
        start: new Date(people.find(p => p.id === personId)?.startDate || ''),
        end: new Date(people.find(p => p.id === personId)?.endDate || '')
      })
    );
  }, [people]);

  const handleNextDuty = useCallback(async () => {
    const currentIndex = people.findIndex(p => p.id === currentDuty?.id);
    let nextIndex = (currentIndex + 1) % people.length;
    let nextPersonId = people[nextIndex].id;
    
    while (isPersonAbsent(nextPersonId)) {
      nextIndex = (nextIndex + 1) % people.length;
      nextPersonId = people[nextIndex].id;
    }
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const newDutyHistory = [
      {
        date: today,
        personId: nextPersonId,
      },
      ...dutyHistory.slice(0, 9),
    ];

    await updateSharedData({
      currentDuty: nextPersonId,
      dutyHistory: newDutyHistory,
    });
  }, [people, dutyHistory, currentDuty, isPersonAbsent, updateSharedData]);

  const handleAddAbsence = useCallback(async () => {
    if (!absenceStartDate || !absenceEndDate) return;

    const newAbsence: Absence = {
      personId: selectedPerson,
      startDate: format(parseISO(absenceStartDate), 'yyyy-MM-dd'),
      endDate: format(parseISO(absenceEndDate), 'yyyy-MM-dd'),
      reason: absenceReason,
    };

    const newAbsences = [...people.find(p => p.id === selectedPerson)?.absences || [], newAbsence];
    await updateSharedData({
      people: people.map(p => p.id === selectedPerson ? { ...p, absences: newAbsences } : p),
    });
    
    setShowAbsenceForm(false);
    setAbsenceStartDate('');
    setAbsenceEndDate('');
    setAbsenceReason('');
  }, [absenceStartDate, absenceEndDate, absenceReason, selectedPerson, people, updateSharedData]);

  const handleRemoveAbsence = useCallback(async (index: number) => {
    const newAbsences = people.find(p => p.id === selectedPerson)?.absences?.filter((_: any, i: number) => i !== index) || [];
    await updateSharedData({
      people: people.map(p => p.id === selectedPerson ? { ...p, absences: newAbsences } : p),
    });
  }, [selectedPerson, people, updateSharedData]);

  const getAbsenceInfo = useCallback((personId: string) => {
    const person = people.find(p => p.id === personId);
    if (!person) return null;
    const absence = person.absences?.find((a: Absence) => a.personId === personId);
    if (!absence) return null;
    return {
      startDate: format(new Date(absence.startDate), 'M月d日', { locale: ja }),
      endDate: format(new Date(absence.endDate), 'M月d日', { locale: ja }),
      reason: absence.reason,
    };
  }, [people]);

  const handleChangeDuty = useCallback(async (date: string, personId: string) => {
    try {
      const filtered = dutyHistory.filter(r => r.date !== date);
      const newHistory = [
        { date, personId },
        ...filtered
      ].slice(0, 30);
      await updateSharedData({ dutyHistory: newHistory });
    } catch (e) {
      alert('担当者の変更に失敗しました');
    }
  }, [dutyHistory, updateSharedData]);

  const handleDeleteDuty = useCallback(async (date: string) => {
    try {
      const newHistory = dutyHistory.filter(r => r.date !== date);
      await updateSharedData({ dutyHistory: newHistory });
    } catch (e) {
      alert('担当履歴の削除に失敗しました');
    }
  }, [dutyHistory, updateSharedData]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">当番管理</h1>
        <Calendar
          people={memoizedPeople}
          dutyHistory={memoizedDutyHistory}
          currentDuty={memoizedCurrentDuty}
          onUpdateDuty={updateSharedData}
        />
      </div>
    </main>
  );
} 