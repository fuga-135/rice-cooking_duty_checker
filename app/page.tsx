'use client';

import { useState, useEffect } from 'react';
import { format, addDays, isWithinInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import { db } from './firebase';
import { collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

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

export default function Home() {
  const [sharedData, setSharedData] = useState<SharedData>(initialData);
  const [isLoading, setIsLoading] = useState(true);

  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<number>(1);
  const [absenceStartDate, setAbsenceStartDate] = useState('');
  const [absenceEndDate, setAbsenceEndDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'duty', 'shared'), (doc) => {
      if (doc.exists()) {
        setSharedData(doc.data() as SharedData);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateSharedData = async (newData: Partial<SharedData>) => {
    const docRef = doc(db, 'duty', 'shared');
    await setDoc(docRef, { ...sharedData, ...newData }, { merge: true });
  };

  const handleInitialSetup = async () => {
    if (sharedData.people.some(p => !p.name.trim())) {
      alert('全員の名前を入力してください。');
      return;
    }
    await updateSharedData({ isInitialized: true });
  };

  const handleNameChange = async (id: number, name: string) => {
    const newPeople = sharedData.people.map(p => p.id === id ? { ...p, name } : p);
    await updateSharedData({ people: newPeople });
  };

  const isPersonAbsent = (personId: number) => {
    const today = new Date();
    return sharedData.absences.some(absence => 
      absence.personId === personId &&
      isWithinInterval(today, {
        start: new Date(absence.startDate),
        end: new Date(absence.endDate)
      })
    );
  };

  const handleNextDuty = async () => {
    const currentIndex = sharedData.people.findIndex(p => p.id === sharedData.currentDuty);
    let nextIndex = (currentIndex + 1) % sharedData.people.length;
    let nextPersonId = sharedData.people[nextIndex].id;
    
    while (isPersonAbsent(nextPersonId)) {
      nextIndex = (nextIndex + 1) % sharedData.people.length;
      nextPersonId = sharedData.people[nextIndex].id;
    }
    
    const newDutyHistory = [
      {
        date: format(new Date(), 'yyyy-MM-dd'),
        personId: nextPersonId,
      },
      ...sharedData.dutyHistory,
    ];

    await updateSharedData({
      currentDuty: nextPersonId,
      dutyHistory: newDutyHistory,
    });
  };

  const handleAddAbsence = async () => {
    if (!absenceStartDate || !absenceEndDate) return;

    const newAbsence: Absence = {
      personId: selectedPerson,
      startDate: absenceStartDate,
      endDate: absenceEndDate,
      reason: absenceReason,
    };

    const newAbsences = [...sharedData.absences, newAbsence];
    await updateSharedData({ absences: newAbsences });
    
    setShowAbsenceForm(false);
    setAbsenceStartDate('');
    setAbsenceEndDate('');
    setAbsenceReason('');
  };

  const handleRemoveAbsence = async (index: number) => {
    const newAbsences = sharedData.absences.filter((_, i) => i !== index);
    await updateSharedData({ absences: newAbsences });
  };

  const getCurrentPerson = () => {
    return sharedData.people.find(p => p.id === sharedData.currentDuty)?.name || '';
  };

  const getAbsenceInfo = (personId: number) => {
    const absence = sharedData.absences.find(a => a.personId === personId);
    if (!absence) return null;
    return {
      startDate: format(new Date(absence.startDate), 'M月d日', { locale: ja }),
      endDate: format(new Date(absence.endDate), 'M月d日', { locale: ja }),
      reason: absence.reason,
    };
  };

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
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">ご飯当番チェッカー</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">今日の担当者</h2>
          <p className="text-3xl font-bold text-center mb-4">{getCurrentPerson()}</p>
          <button
            onClick={handleNextDuty}
            className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg text-lg font-medium hover:bg-blue-600 active:bg-blue-700 transition-colors"
          >
            次の担当者に切り替え
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">不在期間の設定</h2>
            <button
              onClick={() => setShowAbsenceForm(!showAbsenceForm)}
              className="bg-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-300 active:bg-gray-400 transition-colors"
            >
              {showAbsenceForm ? 'キャンセル' : '不在期間を追加'}
            </button>
          </div>

          {showAbsenceForm && (
            <div className="space-y-3 mb-4 p-3 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium mb-1">担当者</label>
                <select
                  value={selectedPerson}
                  onChange={(e) => setSelectedPerson(Number(e.target.value))}
                  className="w-full p-3 border rounded-lg text-lg"
                >
                  {sharedData.people.map(person => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">開始日</label>
                <input
                  type="date"
                  value={absenceStartDate}
                  onChange={(e) => setAbsenceStartDate(e.target.value)}
                  className="w-full p-3 border rounded-lg text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">終了日</label>
                <input
                  type="date"
                  value={absenceEndDate}
                  onChange={(e) => setAbsenceEndDate(e.target.value)}
                  className="w-full p-3 border rounded-lg text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">理由（任意）</label>
                <input
                  type="text"
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  placeholder="例：旅行"
                  className="w-full p-3 border rounded-lg text-lg"
                />
              </div>
              <button
                onClick={handleAddAbsence}
                className="w-full bg-green-500 text-white py-3 px-4 rounded-lg text-lg font-medium hover:bg-green-600 active:bg-green-700 transition-colors"
              >
                追加
              </button>
            </div>
          )}

          <div className="space-y-2">
            {sharedData.people.map(person => {
              const absenceInfo = getAbsenceInfo(person.id);
              return (
                <div key={person.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-lg">{person.name}</span>
                    {absenceInfo && (
                      <div className="text-sm text-gray-600 mt-1">
                        {absenceInfo.startDate}〜{absenceInfo.endDate}
                        {absenceInfo.reason && <div className="text-xs mt-1">理由: {absenceInfo.reason}</div>}
                      </div>
                    )}
                  </div>
                  {absenceInfo && (
                    <button
                      onClick={() => handleRemoveAbsence(sharedData.absences.findIndex(a => a.personId === person.id))}
                      className="text-red-500 hover:text-red-700 active:text-red-800 p-2"
                    >
                      削除
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4">
          <h2 className="text-lg font-semibold mb-3">担当履歴</h2>
          <div className="space-y-2">
            {sharedData.dutyHistory.map((record, index) => (
              <div key={index} className="flex justify-between items-center border-b pb-2">
                <span className="text-sm">{format(new Date(record.date), 'yyyy年MM月dd日', { locale: ja })}</span>
                <span className="font-medium">{sharedData.people.find(p => p.id === record.personId)?.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
} 