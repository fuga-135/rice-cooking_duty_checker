'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays, isWithinInterval, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { db } from './firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, query, limit, serverTimestamp } from 'firebase/firestore';
import Calendar from './components/Calendar';

type Person = {
  id: number;
  name: string;
};

type DutyRecord = {
  date: string;
  personId: number;
};

type Absence = {
  personId: number;
  startDate: string;
  endDate: string;
  reason: string;
};

type SharedData = {
  people: Person[];
  currentDuty: number;
  dutyHistory: DutyRecord[];
  absences: Absence[];
  isInitialized: boolean;
};

const initialData: SharedData = {
  people: [
    { id: 1, name: '' },
    { id: 2, name: '' },
    { id: 3, name: '' },
  ],
  currentDuty: 1,
  dutyHistory: [],
  absences: [],
  isInitialized: false,
};

const SHARED_DOC_ID = 'shared';

export default function Home() {
  const [sharedData, setSharedData] = useState<SharedData>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<number>(1);
  const [absenceStartDate, setAbsenceStartDate] = useState('');
  const [absenceEndDate, setAbsenceEndDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');

  useEffect(() => {
    const docRef = doc(db, 'duty', SHARED_DOC_ID);
    let initialLoad = true;

    const createInitialData = async () => {
      try {
        const initialDataWithTimestamp = {
          ...initialData,
          lastUpdated: serverTimestamp()
        };
        await setDoc(docRef, initialDataWithTimestamp);
        setSharedData(initialData);
        setIsInitialized(false);
      } catch (error) {
        console.error("Error creating initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as SharedData;
        const parsedData = {
          ...data,
          dutyHistory: data.dutyHistory.map(record => ({
            ...record,
            date: format(parseISO(record.date), 'yyyy-MM-dd')
          })),
          absences: data.absences.map(absence => ({
            ...absence,
            startDate: format(parseISO(absence.startDate), 'yyyy-MM-dd'),
            endDate: format(parseISO(absence.endDate), 'yyyy-MM-dd')
          }))
        };
        setSharedData(parsedData);
        setIsInitialized(parsedData.isInitialized);
        setIsLoading(false);
      } else if (initialLoad) {
        createInitialData();
      }
      initialLoad = false;
    }, (error) => {
      console.error("Error in real-time update:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateSharedData = useCallback(async (newData: Partial<SharedData>) => {
    try {
      const docRef = doc(db, 'duty', SHARED_DOC_ID);
      const currentData = { 
        ...sharedData, 
        ...newData,
        lastUpdated: serverTimestamp()
      };
      
      if (currentData.dutyHistory) {
        currentData.dutyHistory = currentData.dutyHistory.slice(0, 10);
      }
      
      await setDoc(docRef, currentData);
    } catch (error) {
      console.error("Error updating data:", error);
      alert('データの更新に失敗しました。もう一度お試しください。');
    }
  }, [sharedData]);

  const handleInitialSetup = useCallback(async () => {
    if (sharedData.people.some(p => !p.name.trim())) {
      alert('全員の名前を入力してください。');
      return;
    }

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const initialDutyHistory = [{
        date: today,
        personId: 1
      }];

      await updateSharedData({ 
        isInitialized: true,
        people: sharedData.people,
        currentDuty: 1,
        dutyHistory: initialDutyHistory,
        absences: []
      });
    } catch (error) {
      console.error("Error in initial setup:", error);
      alert('初期設定に失敗しました。もう一度お試しください。');
    }
  }, [sharedData.people, updateSharedData]);

  const handleNameChange = useCallback(async (id: number, name: string) => {
    const newPeople = sharedData.people.map(p => p.id === id ? { ...p, name } : p);
    await updateSharedData({ people: newPeople });
  }, [sharedData.people, updateSharedData]);

  const isPersonAbsent = useCallback((personId: number) => {
    const today = new Date();
    return sharedData.absences.some(absence => 
      absence.personId === personId &&
      isWithinInterval(today, {
        start: new Date(absence.startDate),
        end: new Date(absence.endDate)
      })
    );
  }, [sharedData.absences]);

  const handleNextDuty = useCallback(async () => {
    const currentIndex = sharedData.people.findIndex(p => p.id === sharedData.currentDuty);
    let nextIndex = (currentIndex + 1) % sharedData.people.length;
    let nextPersonId = sharedData.people[nextIndex].id;
    
    while (isPersonAbsent(nextPersonId)) {
      nextIndex = (nextIndex + 1) % sharedData.people.length;
      nextPersonId = sharedData.people[nextIndex].id;
    }
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const newDutyHistory = [
      {
        date: today,
        personId: nextPersonId,
      },
      ...sharedData.dutyHistory.slice(0, 9),
    ];

    await updateSharedData({
      currentDuty: nextPersonId,
      dutyHistory: newDutyHistory,
    });
  }, [sharedData, isPersonAbsent, updateSharedData]);

  const handleAddAbsence = useCallback(async () => {
    if (!absenceStartDate || !absenceEndDate) return;

    const newAbsence: Absence = {
      personId: selectedPerson,
      startDate: format(parseISO(absenceStartDate), 'yyyy-MM-dd'),
      endDate: format(parseISO(absenceEndDate), 'yyyy-MM-dd'),
      reason: absenceReason,
    };

    const newAbsences = [...sharedData.absences, newAbsence];
    await updateSharedData({ absences: newAbsences });
    
    setShowAbsenceForm(false);
    setAbsenceStartDate('');
    setAbsenceEndDate('');
    setAbsenceReason('');
  }, [absenceStartDate, absenceEndDate, absenceReason, selectedPerson, sharedData.absences, updateSharedData]);

  const handleRemoveAbsence = useCallback(async (index: number) => {
    const newAbsences = sharedData.absences.filter((_, i) => i !== index);
    await updateSharedData({ absences: newAbsences });
  }, [sharedData.absences, updateSharedData]);

  const currentPerson = useMemo(() => 
    sharedData.people.find(p => p.id === sharedData.currentDuty)?.name || ''
  , [sharedData.people, sharedData.currentDuty]);

  const getAbsenceInfo = useCallback((personId: number) => {
    const absence = sharedData.absences.find(a => a.personId === personId);
    if (!absence) return null;
    return {
      startDate: format(new Date(absence.startDate), 'M月d日', { locale: ja }),
      endDate: format(new Date(absence.endDate), 'M月d日', { locale: ja }),
      reason: absence.reason,
    };
  }, [sharedData.absences]);

  const handleChangeDuty = useCallback(async (date: string, personId: number) => {
    try {
      const filtered = sharedData.dutyHistory.filter(r => r.date !== date);
      const newHistory = [
        { date, personId },
        ...filtered
      ].slice(0, 30);
      await updateSharedData({ dutyHistory: newHistory });
    } catch (e) {
      alert('担当者の変更に失敗しました');
    }
  }, [sharedData.dutyHistory, updateSharedData]);

  const handleDeleteDuty = useCallback(async (date: string) => {
    try {
      const newHistory = sharedData.dutyHistory.filter(r => r.date !== date);
      await updateSharedData({ dutyHistory: newHistory });
    } catch (e) {
      alert('担当履歴の削除に失敗しました');
    }
  }, [sharedData.dutyHistory, updateSharedData]);

  if (isLoading) {
    return (
      <main className="min-h-screen p-4 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </main>
    );
  }

  if (!sharedData.isInitialized) {
    return (
      <main className="min-h-screen p-4 bg-gray-50">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-6 text-center">初期設定</h1>
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-lg font-semibold mb-4">担当者の名前を入力してください</h2>
            <div className="space-y-4">
              {sharedData.people.map(person => (
                <div key={person.id}>
                  <label className="block text-sm font-medium mb-1">
                    {person.id}人目
                  </label>
                  <input
                    type="text"
                    value={person.name}
                    onChange={(e) => handleNameChange(person.id, e.target.value)}
                    placeholder="名前を入力"
                    className="w-full p-3 border rounded text-lg"
                  />
                </div>
              ))}
              <button
                onClick={handleInitialSetup}
                className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg text-lg font-medium hover:bg-blue-600 active:bg-blue-700 transition-colors"
              >
                設定を完了
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">ご飯当番チェッカー</h1>
        <Calendar
          dutyHistory={sharedData.dutyHistory}
          people={sharedData.people}
          onChangeDuty={handleChangeDuty}
          onDeleteDuty={handleDeleteDuty}
        />
      </div>
    </main>
  );
} 