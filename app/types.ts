export type Person = {
  id: string;
  name: string;
  absences?: Absence[];
  startDate?: string;
  endDate?: string;
};

export type DutyHistory = {
  date: string;
  personId: string;
};

export type Absence = {
  personId: string;
  startDate: string;
  endDate: string;
  reason: string;
}; 