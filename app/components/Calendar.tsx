import { useEffect, useState, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { DateClickArg } from '@fullcalendar/interaction';

// 担当者編集用モーダル
function EditDutyModal({
  open,
  date,
  people,
  selectedPersonId,
  onChange,
  onDelete,
  onClose
}: {
  open: boolean;
  date: string;
  people: { id: number; name: string }[];
  selectedPersonId?: number;
  onChange: (personId: number) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [personId, setPersonId] = useState(selectedPersonId ?? people[0]?.id ?? 1);
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 min-w-[300px]">
        <h3 className="text-lg font-bold mb-4">{date} の担当者</h3>
        <select
          className="w-full p-2 border rounded mb-4"
          value={personId}
          onChange={e => setPersonId(Number(e.target.value))}
        >
          {people.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
            onClick={() => onChange(personId)}
          >
            担当を変更
          </button>
          <button
            className="flex-1 bg-red-500 text-white py-2 rounded hover:bg-red-600"
            onClick={onDelete}
          >
            削除
          </button>
        </div>
        <button className="mt-4 w-full text-gray-500" onClick={onClose}>キャンセル</button>
      </div>
    </div>
  );
}

type CalendarProps = {
  dutyHistory: Array<{
    date: string;
    personId: number;
  }>;
  people: Array<{
    id: number;
    name: string;
  }>;
  onChangeDuty: (date: string, personId: number) => void;
  onDeleteDuty: (date: string) => void;
};

const colors = [
  '#4F46E5', // indigo
  '#7C3AED', // violet
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
];

export default function Calendar({ dutyHistory, people, onChangeDuty, onDeleteDuty }: CalendarProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedPersonId, setSelectedPersonId] = useState<number | undefined>(undefined);

  const events = useMemo(() => {
    return dutyHistory.map((record, index) => {
      const person = people.find(p => p.id === record.personId);
      return {
        title: person ? person.name : '',
        date: record.date,
        backgroundColor: colors[index % colors.length],
        borderColor: '#fff',
        textColor: '#fff',
        extendedProps: { personId: record.personId }
      };
    });
  }, [dutyHistory, people]);

  // 日付クリック時の処理
  const handleDateClick = (arg: DateClickArg) => {
    setSelectedDate(arg.dateStr);
    const found = dutyHistory.find(r => r.date === arg.dateStr);
    setSelectedPersonId(found?.personId);
    setModalOpen(true);
  };

  // 担当者変更
  const handleChange = (personId: number) => {
    onChangeDuty(selectedDate, personId);
    setModalOpen(false);
  };
  // 担当履歴削除
  const handleDelete = () => {
    onDeleteDuty(selectedDate);
    setModalOpen(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h2 className="text-lg font-semibold mb-4">当番カレンダー</h2>
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={ja}
        events={events}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth'
        }}
        height="auto"
        lazyFetching={true}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          meridiem: false
        }}
        dateClick={handleDateClick}
      />
      <EditDutyModal
        open={modalOpen}
        date={selectedDate}
        people={people}
        selectedPersonId={selectedPersonId}
        onChange={handleChange}
        onDelete={handleDelete}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
} 