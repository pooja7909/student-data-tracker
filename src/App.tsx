import React, { useState, useMemo, useEffect, useCallback } from 'react';


import { supabase } from './supabaseClient';

import { 
  Users, 
  BarChart3, 
  Settings, 
  Plus, 
  Upload, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Trash2,
  Download,
  Search,
  Filter,
  X
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  Cell
} from 'recharts';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
//import { createClient } from '@supabase/supabase-js';
import { 
  Student, 
  Assessment, 
  Mark, 
  GradeBoundary, 
  YearGroup, 
  StudentPerformance,
  Group
} from './types';

// ─── Supabase Client ────────────────────────────────────────────────────────
// Replace these with your actual Supabase project URL and anon key
// Tip: move these to a .env file as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
//const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'YOUR_SUPABASE_URL';
//const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'YOUR_SUPABASE_ANON_KEY';
//const supabase = createClient(supabaseUrl, supabaseKey);
// ────────────────────────────────────────────────────────────────────────────

const SUBJECTS_BY_YEAR: Record<YearGroup, string[]> = {
  7: ['Science', 'Computer Science'],
  8: ['Science', 'Computer Science'],
  9: ['Science', 'Computer Science'],
  '10 IGCSE': ['Physics', 'Chemistry', 'Biology', 'Computer Science'],
  '11 IGCSE': ['Physics', 'Chemistry', 'Biology', 'Computer Science'],
  '12 IB': ['Physics', 'Chemistry', 'Biology', 'ESS', 'Computer Science'],
  '13 IB': ['Physics', 'Chemistry', 'Biology', 'ESS', 'Computer Science'],
};

const SUBJECT_COLORS: Record<string, string> = {
  'Science': '#6366f1',
  'Physics': '#3b82f6',
  'Chemistry': '#10b981',
  'Biology': '#f59e0b',
  'Computer Science': '#8b5cf6',
  'ESS': '#ec4899',
};

const DEFAULT_BOUNDARIES: GradeBoundary[] = [
  { grade: 'A*', minPercentage: 90 },
  { grade: 'A', minPercentage: 80 },
  { grade: 'B', minPercentage: 70 },
  { grade: 'C', minPercentage: 60 },
  { grade: 'D', minPercentage: 50 },
  { grade: 'E', minPercentage: 40 },
  { grade: 'U', minPercentage: 0 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'performance' | 'students' | 'assessments' | 'settings'>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [yearBoundaries, setYearBoundaries] = useState<Record<YearGroup, GradeBoundary[]>>({
    7: [...DEFAULT_BOUNDARIES],
    8: [...DEFAULT_BOUNDARIES],
    9: [...DEFAULT_BOUNDARIES],
    '10 IGCSE': [...DEFAULT_BOUNDARIES],
    '11 IGCSE': [...DEFAULT_BOUNDARIES],
    '12 IB': [...DEFAULT_BOUNDARIES],
    '13 IB': [...DEFAULT_BOUNDARIES],
  });
  const [selectedYearForSettings, setSelectedYearForSettings] = useState<YearGroup>(7);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<YearGroup | 'all' | 'IGCSE_ALL' | 'IB_ALL'>('all');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showMarksModal, setShowMarksModal] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ data: any[], fileName: string, sheetName?: string } | null>(null);
  const [importConfig, setImportConfig] = useState({ 
    yearGroup: 7 as YearGroup, 
    groupName: '', 
    assessmentName: '', 
    subject: 'Science', 
    maxMarks: 100, 
    date: new Date().toISOString().split('T')[0] 
  });
  const [marksGroupFilter, setMarksGroupFilter] = useState<string>('all');
  const [newAssessment, setNewAssessment] = useState({ name: '', subject: 'Science', maxMarks: 100, date: new Date().toISOString().split('T')[0], yearGroup: 7 as YearGroup });
  const [newStudent, setNewStudent] = useState({ name: '', yearGroup: 7 as YearGroup, groupName: '' });
  const [performanceSubjectFilter, setPerformanceSubjectFilter] = useState<string>('all');
  const [selectedStudentForPerformance, setSelectedStudentForPerformance] = useState<string | 'none'>('none');

  // ─── LOAD DATA FROM SUPABASE ON MOUNT ──────────────────────────────────────
  useEffect(() => {
  const loadData = async () => {
    const { data, error } = await supabase
      .from("app_data")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    if (data?.data) {
      const parsed = data.data;

      setStudents(parsed.students || []);
      setAssessments(parsed.assessments || []);
      setMarks(parsed.marks || []);
      setGroups(parsed.groups || []);
      setYearBoundaries(parsed.yearBoundaries || {});
    }
  };

  loadData();
}, []);

  // ─── SAVE DATA TO SUPABASE WHENEVER STATE CHANGES ──────────────────────────
  // Using a debounced save so we don't hammer Supabase on every keystroke
 useEffect(() => {
  const saveData = async () => {
    const payload = {
      students,
      assessments,
      marks,
      groups,
      yearBoundaries
    };

    await supabase
      .from("app_data")
      .upsert({ id: 1, data: payload });
  };

  saveData();
}, [students, assessments, marks, groups, yearBoundaries]);

  useEffect(() => {
    // Don't save while still loading initial data (would overwrite with empty state)
    if (isLoading) return;

    const handler = setTimeout(() => {
      saveData({ students, assessments, marks, groups, yearBoundaries });
    }, 800); // debounce: wait 800ms after last change before saving

    return () => clearTimeout(handler);
  }, [students, assessments, marks, groups, yearBoundaries, isLoading, saveData]);
  // ────────────────────────────────────────────────────────────────────────────

  // Helper for year group display
  const formatYearGroup = (y: YearGroup) => {
    return typeof y === 'number' ? `Year ${y}` : y;
  };

  // Helper for year group matching
  const matchesYearFilter = (itemYear: YearGroup, filter: YearGroup | 'all' | 'IGCSE_ALL' | 'IB_ALL') => {
    if (filter === 'all') return true;
    if (filter === 'IGCSE_ALL') return (itemYear as any) === 10 || (itemYear as any) === 11 || String(itemYear).includes('IGCSE');
    if (filter === 'IB_ALL') return (itemYear as any) === 12 || (itemYear as any) === 13 || String(itemYear).includes('IB');
    return itemYear === filter;
  };

  // Data Migration for old year formats
  useEffect(() => {
    if (isLoading) return;
    const migrateYear = (y: any): YearGroup => {
      if (y === 10 || y === '10') return '10 IGCSE';
      if (y === 11 || y === '11') return '11 IGCSE';
      if (y === 12 || y === '12') return '12 IB';
      if (y === 13 || y === '13') return '13 IB';
      return y as YearGroup;
    };

    const migratedStudents = students.map(s => ({ ...s, yearGroup: migrateYear(s.yearGroup) }));
    if (JSON.stringify(migratedStudents) !== JSON.stringify(students)) {
      setStudents(migratedStudents);
    }

    const migratedAssessments = assessments.map(a => ({ ...a, yearGroup: migrateYear(a.yearGroup) }));
    if (JSON.stringify(migratedAssessments) !== JSON.stringify(assessments)) {
      setAssessments(migratedAssessments);
    }
  }, [students, assessments, isLoading]);

  // Derived Data
  const performances = useMemo(() => {
    return students.map(student => {
      const studentMarks = marks
        .filter(m => m.studentId === student.id)
        .map(m => ({
          ...m,
          assessment: assessments.find(a => a.id === m.assessmentId)!
        }))
        .filter(m => m.assessment)
        .sort((a, b) => new Date(a.assessment.date).getTime() - new Date(b.assessment.date).getTime());

      const totalPercentage = studentMarks.reduce((acc, m) => acc + (m.score / m.assessment.maxMarks) * 100, 0);
      const averagePercentage = studentMarks.length > 0 ? totalPercentage / studentMarks.length : 0;

      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (studentMarks.length >= 2) {
        const last = (studentMarks[studentMarks.length - 1].score / studentMarks[studentMarks.length - 1].assessment.maxMarks) * 100;
        const prev = (studentMarks[studentMarks.length - 2].score / studentMarks[studentMarks.length - 2].assessment.maxMarks) * 100;
        if (last > prev + 2) trend = 'improving';
        else if (last < prev - 2) trend = 'declining';
      }

      let status: 'excellent' | 'on-track' | 'needs-improvement' = 'on-track';
      const currentBoundaries = yearBoundaries[student.yearGroup];
      
      if (averagePercentage >= (currentBoundaries.find(b => b.grade === 'A' || b.grade === 'A*')?.minPercentage || 80)) status = 'excellent';
      else if (averagePercentage < (currentBoundaries.find(b => b.grade === 'E' || b.grade === 'U')?.minPercentage || 40)) status = 'needs-improvement';

      return {
        student,
        marks: studentMarks,
        averagePercentage,
        trend,
        status
      } as StudentPerformance;
    });
  }, [students, assessments, marks]);

  const filteredPerformances = useMemo(() => {
    return performances.filter(p => {
      const matchesSearch = p.student.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesYear = matchesYearFilter(p.student.yearGroup, yearFilter);
      return matchesSearch && matchesYear;
    });
  }, [performances, searchQuery, yearFilter]);

  

  const performanceTabStats = useMemo(() => {
    return students.map(student => {
      const studentMarks = marks
        .filter(m => m.studentId === student.id)
        .map(m => ({
          ...m,
          assessment: assessments.find(a => a.id === m.assessmentId)!
        }))
        .filter(m => m.assessment && (performanceSubjectFilter === 'all' || m.assessment.subject === performanceSubjectFilter))
        .filter(m => matchesYearFilter(m.assessment.yearGroup, yearFilter))
        .sort((a, b) => new Date(a.assessment.date).getTime() - new Date(b.assessment.date).getTime());

      const totalPercentage = studentMarks.reduce((acc, m) => acc + (m.score / m.assessment.maxMarks) * 100, 0);
      const averagePercentage = studentMarks.length > 0 ? totalPercentage / studentMarks.length : 0;

      return {
        student,
        averagePercentage,
        count: studentMarks.length
      };
    }).filter(p => p.count > 0);
  }, [students, assessments, marks, performanceSubjectFilter, yearFilter]);

  const topPerformersList = useMemo(() => {
    return [...performanceTabStats]
      .sort((a, b) => b.averagePercentage - a.averagePercentage)
      .slice(0, 5);
  }, [performanceTabStats]);

  const needsSupportList = useMemo(() => {
    return [...performanceTabStats]
      .sort((a, b) => a.averagePercentage - b.averagePercentage)
      .slice(0, 5);
  }, [performanceTabStats]);

  const performanceInsights = useMemo(() => {
    if (performanceTabStats.length === 0) return null;

    const avg = performanceTabStats.reduce((acc, p) => acc + p.averagePercentage, 0) / performanceTabStats.length;
    
    const studentTrends = performances
      .filter(p => performanceTabStats.some(ps => ps.student.id === p.student.id))
      .map(p => {
        if (p.marks.length < 2) return { id: p.student.id, improvement: 0 };
        const last = (p.marks[p.marks.length - 1].score / p.marks[p.marks.length - 1].assessment.maxMarks) * 100;
        const first = (p.marks[0].score / p.marks[0].assessment.maxMarks) * 100;
        return { id: p.student.id, name: p.student.name, improvement: last - first };
      })
      .sort((a, b) => b.improvement - a.improvement);

    const mostImproved = studentTrends[0]?.improvement > 0 ? studentTrends[0] : null;

    const groupMap: Record<string, { total: number, count: number }> = {};
    performanceTabStats.forEach(p => {
      const key = p.student.groupName || 'General';
      if (!groupMap[key]) groupMap[key] = { total: 0, count: 0 };
      groupMap[key].total += p.averagePercentage;
      groupMap[key].count += 1;
    });
    const bestGroup = Object.entries(groupMap)
      .map(([name, data]) => ({ name, avg: data.total / data.count }))
      .sort((a, b) => b.avg - a.avg)[0];

    return {
      average: avg,
      mostImproved,
      bestGroup
    };
  }, [performanceTabStats, performances]);

  const individualStudentTrendData = useMemo(() => {
    if (selectedStudentForPerformance === 'none') return [];
    
    return marks
      .filter(m => m.studentId === selectedStudentForPerformance)
      .map(m => ({
        ...m,
        assessment: assessments.find(a => a.id === m.assessmentId)!
      }))
      .filter(m => m.assessment && (performanceSubjectFilter === 'all' || m.assessment.subject === performanceSubjectFilter))
      .filter(m => matchesYearFilter(m.assessment.yearGroup, yearFilter))
      .sort((a, b) => new Date(a.assessment.date).getTime() - new Date(b.assessment.date).getTime())
      .map(m => ({
        date: new Date(m.assessment.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        score: (m.score / m.assessment.maxMarks) * 100,
        assessmentName: m.assessment.name,
        subject: m.assessment.subject
      }));
  }, [selectedStudentForPerformance, marks, assessments, performanceSubjectFilter, yearFilter]);

  const subjectTrendData = useMemo(() => {
    const relevantAssessments = assessments
      .filter(a => matchesYearFilter(a.yearGroup, yearFilter))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return relevantAssessments.map(assessment => {
      const assessmentMarks = marks.filter(m => m.assessmentId === assessment.id);
      const avg = assessmentMarks.length > 0
        ? assessmentMarks.reduce((acc, m) => acc + (m.score / assessment.maxMarks) * 100, 0) / assessmentMarks.length
        : 0;
      return {
        date: assessment.date,
        name: assessment.name,
        average: parseFloat(avg.toFixed(1)),
        subject: assessment.subject
      };
    });
  }, [assessments, marks, yearFilter]);

  const groupPerformanceData = useMemo(() => {
    const relevantPerformances = performances.filter(p => matchesYearFilter(p.student.yearGroup, yearFilter));
    const groupMap: Record<string, { total: number, count: number }> = {};
    
    relevantPerformances.forEach(p => {
      const key = p.student.groupName || 'General';
      if (!groupMap[key]) groupMap[key] = { total: 0, count: 0 };
      groupMap[key].total += p.averagePercentage;
      groupMap[key].count += 1;
    });

    return Object.entries(groupMap)
      .map(([group, data]) => ({
        group,
        average: data.total / data.count
      }))
      .sort((a, b) => b.average - a.average);
  }, [performances, yearFilter]);

  const subjectPerformanceData = useMemo(() => {
    const subjects = Array.from(new Set(assessments.map(a => a.subject)));
    return subjects.map(subject => {
      const subjectMarks = marks.filter(m => {
        const a = assessments.find(as => as.id === m.assessmentId);
        return a?.subject === subject;
      });
      const avg = subjectMarks.length > 0
        ? subjectMarks.reduce((acc, m) => {
            const a = assessments.find(as => as.id === m.assessmentId)!;
            return acc + (m.score / a.maxMarks) * 100;
          }, 0) / subjectMarks.length
        : 0;
      return {
        subject,
        average: parseFloat(avg.toFixed(1)),
        count: subjectMarks.length
      };
    });
  }, [assessments, marks]);

  const classPerformanceData = useMemo(() => {
    const yearGroups: YearGroup[] = [7, 8, 9, '10 IGCSE', '11 IGCSE', '12 IB', '13 IB'];
    return yearGroups
      .filter(y => matchesYearFilter(y, yearFilter))
      .map(year => {
      const yearPerformances = performances.filter(p => p.student.yearGroup === year);
      const avg = yearPerformances.length > 0 
        ? yearPerformances.reduce((acc, p) => acc + p.averagePercentage, 0) / yearPerformances.length 
        : 0;
      return {
        year: typeof year === 'number' ? `Year ${year}` : year,
        average: parseFloat(avg.toFixed(1)),
        count: yearPerformances.length
      };
    }).filter(d => d.count > 0);
  }, [performances]);

  const backupData = () => {
    const data = { students, assessments, marks, groups, yearBoundaries };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `science_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const restoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target?.result as string);
          if (data.students && data.assessments && data.marks) {
            setStudents(data.students);
            setAssessments(data.assessments);
            setMarks(data.marks);
            if (data.groups) setGroups(data.groups);
            if (data.yearBoundaries) setYearBoundaries(data.yearBoundaries);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 3000);
          }
        } catch (err) {
          alert('Invalid backup file');
        }
      };
      reader.readAsText(file);
    }
  };

  const downloadTemplate = () => {
    const headers = ['studentName', 'yearGroup', 'groupName', 'assessmentName', 'subject', 'score', 'maxMarks', 'date'];
    const sampleData = [
      ['John Doe', '10 IGCSE', '10-A', 'Midterm Exam', 'Physics', '85', '100', '2024-03-15'],
      ['Jane Smith', '10 IGCSE', '10-A', 'Midterm Exam', 'Physics', '92', '100', '2024-03-15'],
      ['Bob Wilson', '11 IGCSE', '11-B', 'Unit Test 1', 'Computer Science', '18', '20', '2024-03-10'],
      ['Alice Brown', '12 IB', '12-C', 'Internal Assessment', 'Biology', '22', '24', '2024-03-20']
    ];
    
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'student_marks_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s_]/g, '');

      const processData = (data: any[], sheetName?: string) => {
        if (data.length === 0) return;

        const headers: string[] = Array.from(new Set(data.flatMap((row: any) => Object.keys(row))));
        const metadataHeaders = [
          'studentname', 'name', 'student', 'yeargroup', 'year', 'groupname', 'group', 'class', 'subject', 'date', 'maxmarks', 'assessmentname', 'score', 'mark',
          'upn', 'uln', 'gender', 'dob', 'sen', 'pp', 'fsm', 'eal', 'ethnicity', 'notes', 'comments', 'attendance', 'email', 'id', 'mis_id', '__sheetname'
        ].map(h => normalizeKey(h));

        const hasAssessmentNameColumn = headers.some(h => normalizeKey(h) === 'assessmentname');
        
        setPendingImport({ data, fileName, sheetName });
        
        let guessedYear: YearGroup = 7;
        const yearMatch = fileName.match(/\b(7|8|9|10|11|12|13)\b/i);
        if (yearMatch) {
          const num = parseInt(yearMatch[0]);
          if (num === 10 || num === 11) guessedYear = `${num} IGCSE` as YearGroup;
          else if (num === 12 || num === 13) guessedYear = `${num} IB` as YearGroup;
          else guessedYear = num as YearGroup;
        }
        if (fileName.toLowerCase().includes('igcse')) {
          if (fileName.includes('10')) guessedYear = '10 IGCSE';
          else if (fileName.includes('11')) guessedYear = '11 IGCSE';
        } else if (fileName.toLowerCase().includes('ib')) {
          if (fileName.includes('12')) guessedYear = '12 IB';
          else if (fileName.includes('13')) guessedYear = '13 IB';
        }

        const extraColumns = headers.filter(h => {
          if (metadataHeaders.includes(normalizeKey(h))) return false;
          return data.some((row: any) => {
            const val = row[h];
            return val !== undefined && val !== null && val !== '' && !isNaN(parseFloat(val));
          });
        });
        
        setImportConfig({
          yearGroup: (yearFilter === 'all' || yearFilter === 'IGCSE_ALL' || yearFilter === 'IB_ALL') ? guessedYear : yearFilter,
          groupName: fileName,
          assessmentName: hasAssessmentNameColumn ? 'Multiple (from File)' : (extraColumns.length > 0 ? 'Multiple Columns' : 'New Assessment'),
          subject: SUBJECTS_BY_YEAR[(yearFilter === 'all' || yearFilter === 'IGCSE_ALL' || yearFilter === 'IB_ALL') ? guessedYear : yearFilter][0],
          maxMarks: 100,
          date: new Date().toISOString().split('T')[0]
        });
        
        setShowImportModal(true);
        e.target.value = '';
      };

      if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const data = evt.target?.result;
          const wb = XLSX.read(data, { type: 'array' });
          
          const allData: any[] = [];
          wb.SheetNames.forEach(wsname => {
            const ws = wb.Sheets[wsname];
            const jsonData = XLSX.utils.sheet_to_json(ws);
            if (jsonData.length > 0) {
              jsonData.forEach((row: any) => {
                row.__sheetName = wsname;
              });
              allData.push(...jsonData);
            }
          });
          
          processData(allData, wb.SheetNames[0]);
        };
        reader.readAsArrayBuffer(file);
      } else {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            processData(results.data);
          }
        });
      }
    }
  };

  const confirmImport = () => {
    if (!pendingImport) return;

    const { data, sheetName: defaultSheetName } = pendingImport;
    const { yearGroup, groupName, assessmentName: defaultAssessmentName, subject: defaultSubject, maxMarks: defaultMaxMarks, date: defaultDate } = importConfig;

    const newMarks: Mark[] = [...marks];
    const newStudents: Student[] = [...students];
    const newAssessments: Assessment[] = [...assessments];
    const newGroups: Group[] = [...groups];

    let group = newGroups.find(g => g.name === groupName && g.yearGroup === yearGroup);
    if (!group) {
      group = {
        id: Math.random().toString(36).substr(2, 9),
        yearGroup,
        name: groupName
      };
      newGroups.push(group);
    }

    const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s_]/g, '');
    const findValue = (row: any, possibleKeys: string[]) => {
      const rowKeys = Object.keys(row);
      const normalizedPossible = possibleKeys.map(k => normalizeKey(k));
      const foundKey = rowKeys.find(rk => normalizedPossible.includes(normalizeKey(rk)));
      return foundKey ? row[foundKey] : undefined;
    };

    const extractInfo = (header: string, rowData?: any, sheetName?: string) => {
      let name = header;
      let maxMarks = defaultMaxMarks;

      const marksMatch = header.match(/\((\d+)\)/);
      if (marksMatch) {
        maxMarks = parseInt(marksMatch[1]);
        name = header.replace(marksMatch[0], '').trim();
      }

      if (rowData && rowData[header]) {
        const subVal = String(rowData[header]);
        const subMarksMatch = subVal.match(/\((\d+)\)/);
        if (subMarksMatch) {
          maxMarks = parseInt(subMarksMatch[1]);
          if (name.startsWith('__EMPTY') || !name || name.toLowerCase() === 'score' || name.toLowerCase() === 'mark') {
            name = subVal.replace(subMarksMatch[0], '').trim() || name;
          }
        }
      }

      if (name.startsWith('__EMPTY') || !name || name.toLowerCase() === 'score' || name.toLowerCase() === 'mark') {
        name = sheetName || 'Test Topic';
      }

      return { name, maxMarks };
    };

    const headers: string[] = Array.from(new Set(data.flatMap((row: any) => Object.keys(row))));
    const metadataHeaders = [
      'studentname', 'name', 'student', 'yeargroup', 'year', 'groupname', 'group', 'class', 'subject', 'date', 'maxmarks', 'assessmentname', 'score', 'mark',
      'upn', 'uln', 'gender', 'dob', 'sen', 'pp', 'fsm', 'eal', 'ethnicity', 'notes', 'comments', 'attendance', 'email', 'id', 'mis_id', '__sheetname'
    ].map(h => normalizeKey(h));

    const hasAssessmentNameColumn = headers.some(h => normalizeKey(h) === 'assessmentname');
    const scoreColumns: string[] = headers.filter(h => {
      if (metadataHeaders.includes(normalizeKey(h))) return false;
      return data.some((row: any) => {
        const val = row[h];
        return val !== undefined && val !== null && val !== '' && !isNaN(parseFloat(val));
      });
    });

    const firstRow = data[0];
    const isFirstRowSubHeader = firstRow && scoreColumns.some(col => String(firstRow[col]).includes('('));
    const dataToProcess = isFirstRowSubHeader ? data.slice(1) : data;

    dataToProcess.forEach((row: any) => {
      const studentName = findValue(row, ['studentname', 'name', 'student']);
      if (!studentName) return;

      const rowSheetName = row.__sheetName || defaultSheetName;

      let student = newStudents.find(s => s.name === studentName && s.yearGroup === yearGroup);
      if (!student) {
        student = { 
          id: Math.random().toString(36).substr(2, 9), 
          name: studentName, 
          yearGroup,
          groupName
        };
        newStudents.push(student);
      } else if (student.groupName !== groupName) {
        student.groupName = groupName;
      }

      if (hasAssessmentNameColumn) {
        const rowAssessmentName = findValue(row, ['assessmentname']) || defaultAssessmentName;
        const rowSubject = findValue(row, ['subject']) || defaultSubject;
        const rowMaxMarks = parseFloat(findValue(row, ['maxmarks'])) || defaultMaxMarks;
        const rowDate = findValue(row, ['date']) || defaultDate;
        const rowScoreRaw = parseFloat(findValue(row, ['score', 'mark'])) || 0;
        const rowScore = Math.min(rowMaxMarks, Math.max(0, rowScoreRaw));

        let assessment = newAssessments.find(a => a.name === rowAssessmentName && a.yearGroup === yearGroup && a.subject === rowSubject);
        if (!assessment) {
          assessment = {
            id: Math.random().toString(36).substr(2, 9),
            name: rowAssessmentName,
            subject: rowSubject,
            maxMarks: rowMaxMarks,
            date: rowDate,
            yearGroup
          };
          newAssessments.push(assessment);
        }

        const existingMarkIdx = newMarks.findIndex(m => m.studentId === student!.id && m.assessmentId === assessment!.id);
        if (existingMarkIdx !== -1) {
          newMarks[existingMarkIdx].score = rowScore;
        } else {
          newMarks.push({ studentId: student!.id, assessmentId: assessment.id, score: rowScore });
        }
      } else if (scoreColumns.length > 0) {
        scoreColumns.forEach(col => {
          if (row[col] === undefined) return;
          
          const rowScoreRaw = parseFloat(row[col]) || 0;
          const { name: rowAssessmentName, maxMarks: rowMaxMarks } = extractInfo(col, isFirstRowSubHeader ? firstRow : null, rowSheetName);
          const rowScore = Math.min(rowMaxMarks, Math.max(0, rowScoreRaw));
          const rowSubject = defaultSubject;
          const rowDate = defaultDate;

          let assessment = newAssessments.find(a => a.name === rowAssessmentName && a.yearGroup === yearGroup && a.subject === rowSubject);
          if (!assessment) {
            assessment = {
              id: Math.random().toString(36).substr(2, 9),
              name: rowAssessmentName,
              subject: rowSubject,
              maxMarks: rowMaxMarks,
              date: rowDate,
              yearGroup
            };
            newAssessments.push(assessment);
          }

          const existingMarkIdx = newMarks.findIndex(m => m.studentId === student!.id && m.assessmentId === assessment!.id);
          if (existingMarkIdx !== -1) {
            newMarks[existingMarkIdx].score = rowScore;
          } else {
            newMarks.push({ studentId: student!.id, assessmentId: assessment.id, score: rowScore });
          }
        });
      } else {
        const rowScoreRaw = parseFloat(findValue(row, ['score', 'mark'])) || 0;
        const rowScore = Math.min(defaultMaxMarks, Math.max(0, rowScoreRaw));
        let assessment = newAssessments.find(a => a.name === defaultAssessmentName && a.yearGroup === yearGroup);
        if (!assessment) {
          assessment = { 
            id: Math.random().toString(36).substr(2, 9), 
            name: defaultAssessmentName, 
            subject: defaultSubject, 
            maxMarks: defaultMaxMarks,
            date: defaultDate,
            yearGroup
          };
          newAssessments.push(assessment);
        }

        const existingMarkIdx = newMarks.findIndex(m => m.studentId === student!.id && m.assessmentId === assessment!.id);
        if (existingMarkIdx !== -1) {
          newMarks[existingMarkIdx].score = rowScore;
        } else {
          newMarks.push({ studentId: student!.id, assessmentId: assessment.id, score: rowScore });
        }
      }
    });

    setGroups(newGroups);
    setStudents(newStudents);
    setAssessments(newAssessments);
    setMarks(newMarks);
    
    setShowImportModal(false);
    setPendingImport(null);
  };

  const handleAddAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAssessmentId) {
      setAssessments(prev => prev.map(a => 
        a.id === editingAssessmentId ? { ...a, ...newAssessment } : a
      ));
    } else {
      const assessment: Assessment = {
        id: Math.random().toString(36).substr(2, 9),
        ...newAssessment
      };
      setAssessments(prev => [...prev, assessment]);
    }
    setShowAssessmentModal(false);
    setEditingAssessmentId(null);
    setNewAssessment(prev => ({ ...prev, name: '' }));
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const student: Student = {
      id: Math.random().toString(36).substr(2, 9),
      ...newStudent
    };
    setStudents(prev => [...prev, student]);
    setShowStudentModal(false);
    setNewStudent(prev => ({ ...prev, name: '' }));
  };

  const handleAddGrade = (isAssessment: boolean = false, assessmentId?: string) => {
    if (isAssessment && assessmentId) {
      setAssessments(prev => prev.map(a => {
        if (a.id === assessmentId) {
          const currentBoundaries = a.boundaries || [...yearBoundaries[students.find(s => marks.find(m => m.assessmentId === a.id)?.studentId === s.id)?.yearGroup || 7]];
          return { ...a, boundaries: [...currentBoundaries, { grade: 'New', minPercentage: 0 }] };
        }
        return a;
      }));
    } else {
      setYearBoundaries(prev => ({
        ...prev,
        [selectedYearForSettings]: [...prev[selectedYearForSettings], { grade: 'New', minPercentage: 0 }]
      }));
    }
  };

  const handleUpdateMark = (studentId: string, assessmentId: string, score: number) => {
    const assessment = assessments.find(a => a.id === assessmentId);
    const maxMarks = assessment?.maxMarks || 100;
    const validatedScore = Math.min(maxMarks, Math.max(0, score));
    setMarks(prev => {
      const filtered = prev.filter(m => !(m.studentId === studentId && m.assessmentId === assessmentId));
      return [...filtered, { studentId, assessmentId, score: validatedScore }];
    });
  };

  const getGrade = (percentage: number, boundaries: GradeBoundary[]) => {
    const sorted = [...boundaries].sort((a, b) => b.minPercentage - a.minPercentage);
    for (const b of sorted) {
      if (percentage >= b.minPercentage) return b.grade;
    }
    return 'U';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'on-track': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'needs-improvement': return 'text-rose-600 bg-rose-50 border-rose-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-emerald-500" />;
      case 'declining': return <TrendingDown className="w-4 h-4 text-rose-500" />;
      default: return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  // ─── LOADING SCREEN ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-600 font-medium">Loading your data...</p>
        </div>
      </div>
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">Science Data Tracker</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Science Department</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
            {[
              { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
              { id: 'performance', icon: TrendingUp, label: 'Performance' },
              { id: 'students', icon: Users, label: 'Students' },
              { id: 'assessments', icon: Plus, label: 'Assessments' },
              { id: 'settings', icon: Settings, label: 'Settings' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/* Save status indicator */}
            <div className={`text-xs font-medium px-2 py-1 rounded-lg transition-all ${
              saveStatus === 'saving' ? 'text-amber-600 bg-amber-50' :
              saveStatus === 'saved' ? 'text-emerald-600 bg-emerald-50' :
              saveStatus === 'error' ? 'text-rose-600 bg-rose-50' :
              'text-transparent'
            }`}>
              {saveStatus === 'saving' ? '● Saving...' :
               saveStatus === 'saved' ? '✓ Saved' :
               saveStatus === 'error' ? '✗ Save failed' : '·'}
            </div>

            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Year Group</span>
              <select 
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                value={yearFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') setYearFilter('all');
                  else if (!isNaN(parseInt(val)) && val.length === 1) setYearFilter(parseInt(val) as YearGroup);
                  else setYearFilter(val as YearGroup);
                }}
              >
                <option value="all">All Years</option>
                <option value="IGCSE_ALL">IGCSE (All)</option>
                <option value="IB_ALL">IB (All)</option>
                {[7, 8, 9, '10 IGCSE', '11 IGCSE', '12 IB', '13 IB'].map(y => (
                  <option key={y} value={y}>{typeof y === 'number' ? `Year ${y}` : y}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={backupData}
              className="btn-secondary flex items-center gap-2 text-sm"
              title="Backup All Data"
            >
              <Download className="w-4 h-4" />
              Backup
            </button>
            <label className="btn-secondary flex items-center gap-2 cursor-pointer text-sm">
              <Upload className="w-4 h-4" />
              Restore
              <input type="file" accept=".json" onChange={restoreBackup} className="hidden" />
            </label>
            <button 
              onClick={downloadTemplate}
              className="btn-secondary flex items-center gap-2 text-sm"
              title="Download CSV Template"
            >
              <Download className="w-4 h-4" />
              Template
            </button>
            <label className="btn-secondary flex items-center gap-2 cursor-pointer text-sm">
              <Upload className="w-4 h-4" />
              Upload CSV/Excel
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="card p-6 flex flex-col justify-between bg-gradient-to-br from-white to-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Students</span>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 leading-none mb-1">{filteredPerformances.length}</h2>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {yearFilter === 'all' 
                        ? `Across ${new Set(students.map(s => s.yearGroup)).size} year groups`
                        : yearFilter === 'IGCSE_ALL' ? 'All IGCSE Students'
                        : yearFilter === 'IB_ALL' ? 'All IB Students'
                        : `In ${formatYearGroup(yearFilter as YearGroup)}`}
                    </p>
                  </div>
                </div>

                <div className="card p-6 flex flex-col justify-between bg-gradient-to-br from-white to-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg. Performance</span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 leading-none mb-1">
                      {(filteredPerformances.reduce((acc, p) => acc + p.averagePercentage, 0) / (filteredPerformances.length || 1)).toFixed(1)}%
                    </h2>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {yearFilter === 'all' ? 'School-wide average' 
                        : yearFilter === 'IGCSE_ALL' ? 'IGCSE average'
                        : yearFilter === 'IB_ALL' ? 'IB average'
                        : `${formatYearGroup(yearFilter as YearGroup)} average`}
                    </p>
                  </div>
                </div>

                <div className="card p-6 flex flex-col justify-between bg-gradient-to-br from-white to-slate-50">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Assessments</span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 leading-none mb-1">
                      {assessments.filter(a => matchesYearFilter(a.yearGroup, yearFilter)).length}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {yearFilter === 'all' ? 'Total recorded tests' : 
                       yearFilter === 'IGCSE_ALL' ? 'Total IGCSE tests' :
                       yearFilter === 'IB_ALL' ? 'Total IB tests' :
                       `Tests for ${formatYearGroup(yearFilter as YearGroup)}`}
                    </p>
                  </div>
                </div>

                <div className="card p-6 flex flex-col justify-between bg-indigo-600 text-white border-none shadow-lg shadow-indigo-200">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Quick Action</span>
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <button 
                      onClick={() => { setActiveTab('assessments'); setShowAssessmentModal(true); }}
                      className="text-lg font-bold hover:underline text-left leading-tight"
                    >
                      Create New Assessment
                    </button>
                    <p className="text-[10px] text-indigo-200 font-medium mt-1">Record new student marks</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Subject Performance</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subjectPerformanceData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis dataKey="subject" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={100} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="average" radius={[0, 4, 4, 0]} barSize={30}>
                          {subjectPerformanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={SUBJECT_COLORS[entry.subject] || '#6366f1'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Year Group Performance</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={classPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                        <Bar dataKey="average" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Group Performance</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={groupPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="group" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                        <Bar dataKey="average" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">Performance Distribution</h3>
                  <div className="space-y-6">
                    {[
                      { label: 'Excellent (80%+)', count: filteredPerformances.filter(p => p.status === 'excellent').length, color: 'bg-emerald-500' },
                      { label: 'On Track (50-80%)', count: filteredPerformances.filter(p => p.status === 'on-track').length, color: 'bg-blue-500' },
                      { label: 'Needs Improvement (<50%)', count: filteredPerformances.filter(p => p.status === 'needs-improvement').length, color: 'bg-rose-500' },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium text-slate-700">{item.label}</span>
                          <span className="text-slate-500 font-bold">{item.count}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.count / (filteredPerformances.length || 1)) * 100}%` }}
                            className={`${item.color} h-full`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'performance' && (
            <motion.div 
              key="performance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Performance Analytics</h2>
                  <p className="text-xs text-slate-500 font-medium">In-depth analysis of student progress and subject trends</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Student</span>
                    <select 
                      className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer min-w-[150px]"
                      value={selectedStudentForPerformance}
                      onChange={(e) => setSelectedStudentForPerformance(e.target.value)}
                    >
                      <option value="none">Select Student...</option>
                      {students
                        .filter(s => matchesYearFilter(s.yearGroup, yearFilter))
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subject</span>
                    <select 
                      className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer min-w-[120px]"
                      value={performanceSubjectFilter}
                      onChange={(e) => setPerformanceSubjectFilter(e.target.value)}
                    >
                      <option value="all">All Subjects</option>
                      {Array.from(new Set(assessments.map(a => a.subject))).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card p-4 flex items-center gap-4 bg-white">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected Average</p>
                    <h4 className="text-xl font-bold text-slate-900">{performanceInsights?.average.toFixed(1) || '0.0'}%</h4>
                  </div>
                </div>
                <div className="card p-4 flex items-center gap-4 bg-white">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Best Group</p>
                    <h4 className="text-xl font-bold text-slate-900">{performanceInsights?.bestGroup?.name || 'N/A'}</h4>
                    <p className="text-[10px] text-emerald-600 font-bold">{performanceInsights?.bestGroup?.avg.toFixed(1)}% Avg</p>
                  </div>
                </div>
                <div className="card p-4 flex items-center gap-4 bg-white">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Most Improved</p>
                    <h4 className="text-xl font-bold text-slate-900 truncate max-w-[150px]">{performanceInsights?.mostImproved?.name || 'N/A'}</h4>
                    <p className="text-[10px] text-amber-600 font-bold">+{performanceInsights?.mostImproved?.improvement.toFixed(1)}% Growth</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-6">
                  <div className="card p-6 bg-gradient-to-b from-white to-emerald-50/30">
                    <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      Top Performers
                    </h3>
                    <div className="space-y-3">
                      {topPerformersList.length > 0 ? topPerformersList.map((p, idx) => (
                        <button 
                          key={p.student.id} 
                          onClick={() => setSelectedStudentForPerformance(p.student.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg transition-all hover:shadow-sm border border-transparent hover:border-slate-100 ${selectedStudentForPerformance === p.student.id ? 'bg-white shadow-sm border-slate-100' : 'hover:bg-white'}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-bold text-slate-300 w-4">{idx + 1}</span>
                            <div className="min-w-0 text-left">
                              <p className="text-xs font-bold text-slate-900 truncate">{p.student.name}</p>
                              <p className="text-[10px] text-slate-500">{p.student.groupName}</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-emerald-600 bg-white px-2 py-0.5 rounded-full border border-emerald-100">
                            {p.averagePercentage.toFixed(1)}%
                          </span>
                        </button>
                      )) : (
                        <p className="text-xs text-slate-400 italic text-center py-4">No data available</p>
                      )}
                    </div>
                  </div>

                  <div className="card p-6 bg-gradient-to-b from-white to-rose-50/30">
                    <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center">
                        <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                      </div>
                      Needs Support
                    </h3>
                    <div className="space-y-3">
                      {needsSupportList.length > 0 ? needsSupportList.map((p, idx) => (
                        <button 
                          key={p.student.id} 
                          onClick={() => setSelectedStudentForPerformance(p.student.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg transition-all hover:shadow-sm border border-transparent hover:border-slate-100 ${selectedStudentForPerformance === p.student.id ? 'bg-white shadow-sm border-slate-100' : 'hover:bg-white'}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-bold text-slate-300 w-4">{idx + 1}</span>
                            <div className="min-w-0 text-left">
                              <p className="text-xs font-bold text-slate-900 truncate">{p.student.name}</p>
                              <p className="text-[10px] text-slate-500">{p.student.groupName}</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-rose-600 bg-white px-2 py-0.5 rounded-full border border-rose-100">
                            {p.averagePercentage.toFixed(1)}%
                          </span>
                        </button>
                      )) : (
                        <p className="text-xs text-slate-400 italic text-center py-4">No data available</p>
                      )}
                    </div>
                  </div>

                  <div className="card p-6">
                    <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-500" />
                      Grade Distribution
                    </h3>
                    <div className="space-y-4">
                      {[
                        { label: 'A*/A', count: performanceTabStats.filter(p => p.averagePercentage >= 80).length, color: 'bg-emerald-500' },
                        { label: 'B/C', count: performanceTabStats.filter(p => p.averagePercentage >= 60 && p.averagePercentage < 80).length, color: 'bg-blue-500' },
                        { label: 'D/E', count: performanceTabStats.filter(p => p.averagePercentage >= 40 && p.averagePercentage < 60).length, color: 'bg-amber-500' },
                        { label: 'U', count: performanceTabStats.filter(p => p.averagePercentage < 40).length, color: 'bg-rose-500' },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="flex justify-between text-[10px] mb-1.5">
                            <span className="font-bold text-slate-600 uppercase tracking-tighter">{item.label}</span>
                            <span className="text-slate-400 font-bold">{item.count} students</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(item.count / (performanceTabStats.length || 1)) * 100}%` }}
                              className={`${item.color} h-full`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-3 space-y-6">
                  {selectedStudentForPerformance !== 'none' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="card p-6 border-indigo-100 bg-indigo-50/10"
                    >
                      <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center justify-between">
                        <span>
                          Individual Progress: <span className="text-indigo-600">{students.find(s => s.id === selectedStudentForPerformance)?.name}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Personal Trend</span>
                          <button onClick={() => setSelectedStudentForPerformance('none')} className="text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={individualStudentTrendData}>
                            <defs>
                              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: number, name: string, props: any) => [
                                `${value.toFixed(1)}%`, 
                                `${props.payload.assessmentName} (${props.payload.subject})`
                              ]}
                            />
                            <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#6366f1' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.div>
                  )}

                  <div className="card p-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center justify-between">
                      Assessment Trend Analysis
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average performance over time</span>
                    </h3>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={subjectTrendData.filter(d => performanceSubjectFilter === 'all' || d.subject === performanceSubjectFilter)}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }} />
                          <Legend verticalAlign="top" align="right" iconType="circle" height={36}/>
                          {(Array.from(new Set(subjectTrendData.map(d => d.subject))) as string[])
                            .filter(subject => performanceSubjectFilter === 'all' || subject === performanceSubjectFilter)
                            .map((subject) => (
                            <Line key={subject} type="monotone" dataKey="average" data={subjectTrendData.filter(d => d.subject === subject)} name={subject} stroke={SUBJECT_COLORS[subject] || '#6366f1'} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="card p-6">
                      <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center justify-between">
                        Subject Comparison
                        <BarChart3 className="w-4 h-4 text-slate-300" />
                      </h3>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={subjectPerformanceData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis dataKey="subject" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={100} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="average" radius={[0, 4, 4, 0]} barSize={20}>
                              {subjectPerformanceData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={SUBJECT_COLORS[entry.subject] || '#6366f1'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="card p-6">
                      <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center justify-between">
                        Group Performance Gap
                        <Users className="w-4 h-4 text-slate-300" />
                      </h3>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={groupPerformanceData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="group" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="average" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={30} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'students' && (
            <motion.div 
              key="students"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="lg:col-span-1 space-y-4">
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      const defaultYear = (yearFilter !== 'all' && yearFilter !== 'IGCSE_ALL' && yearFilter !== 'IB_ALL') ? yearFilter : newStudent.yearGroup;
                      const firstGroup = groups.find(g => g.yearGroup === defaultYear)?.name || '';
                      setNewStudent(prev => ({ ...prev, yearGroup: defaultYear, groupName: prev.groupName || firstGroup }));
                      setShowStudentModal(true);
                    }}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Student
                  </button>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search students..." 
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="card max-h-[calc(100vh-250px)] overflow-y-auto divide-y divide-slate-100">
                  {([7, 8, 9, '10 IGCSE', '11 IGCSE', '12 IB', '13 IB'] as YearGroup[])
                    .filter(y => matchesYearFilter(y, yearFilter))
                    .map(year => {
                      const yearStudents = filteredPerformances.filter(p => p.student.yearGroup === year);
                      const definedGroups = groups.filter(g => g.yearGroup === year).map(g => g.name);
                      const studentGroups = Array.from(new Set(yearStudents.map(p => p.student.groupName)));
                      const yearGroups = Array.from(new Set([...definedGroups, ...studentGroups])).sort();
                      
                      if (yearGroups.length === 0 && yearStudents.length === 0) return null;
                      
                      return (
                        <div key={year} className="bg-white">
                          <div className="px-4 py-2 bg-slate-50 border-y border-slate-100">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{typeof year === 'number' ? `Year ${year}` : year}</h4>
                          </div>
                          {yearGroups.map(groupName => {
                            const groupStudents = yearStudents.filter(p => p.student.groupName === groupName);
                            return (
                              <div key={groupName}>
                                <div className="px-4 py-1.5 bg-white flex items-center justify-between">
                                  <h5 className="text-[9px] font-bold uppercase tracking-tighter text-indigo-400">Group {groupName}</h5>
                                  {groupStudents.length === 0 && (
                                    <span className="text-[8px] text-slate-300 italic">Empty</span>
                                  )}
                                </div>
                                {groupStudents.map((p) => (
                                  <button
                                    key={p.student.id}
                                    onClick={() => setSelectedStudentId(p.student.id)}
                                    className={`w-full text-left px-3 py-1.5 transition-colors flex items-center justify-between group ${
                                      selectedStudentId === p.student.id ? 'bg-indigo-50' : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] ${
                                        selectedStudentId === p.student.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                      }`}>
                                        {p.student.name.split(' ').map(n => n[0]).join('')}
                                      </div>
                                      <p className="font-bold text-slate-900 text-[11px] truncate max-w-[100px]">{p.student.name}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-[8px] px-1 py-0.5 rounded-full border font-bold ${getStatusColor(p.status)}`}>
                                        {p.averagePercentage.toFixed(0)}%
                                      </span>
                                      {getTrendIcon(p.trend)}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="lg:col-span-2">
                {selectedStudentId ? (
                  <div className="space-y-6">
                    {performances.filter(p => p.student.id === selectedStudentId).map(p => (
                      <div key={p.student.id} className="space-y-6">
                        <div className="card p-6">
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <h2 className="text-2xl font-bold text-slate-900">{p.student.name}</h2>
                              <p className="text-slate-500">{formatYearGroup(p.student.yearGroup)} • Overall Average: {p.averagePercentage.toFixed(1)}%</p>
                            </div>
                          </div>

                          <div className="h-[250px] mb-8">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={p.marks.map(m => ({
                                name: m.assessment.name,
                                score: (m.score / m.assessment.maxMarks) * 100
                              }))}>
                                <defs>
                                  <linearGradient id="colorScore2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Area type="monotone" dataKey="score" stroke="#4f46e5" fillOpacity={1} fill="url(#colorScore2)" strokeWidth={2} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-100">
                                  <th className="pb-3 px-2">Assessment</th>
                                  <th className="pb-3 px-2">Subject</th>
                                  <th className="pb-3 px-2">Date</th>
                                  <th className="pb-3 px-2">Score</th>
                                  <th className="pb-3 px-2 text-right">Grade</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {p.marks.map((m, idx) => {
                                  const percentage = (m.score / m.assessment.maxMarks) * 100;
                                  const currentBoundaries = m.assessment.boundaries || yearBoundaries[p.student.yearGroup];
                                  const grade = getGrade(percentage, currentBoundaries);
                                  
                                  return (
                                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                                      <td className="py-3 px-2 font-medium text-slate-900">{m.assessment.name}</td>
                                      <td className="py-3 px-2 text-slate-600">{m.assessment.subject}</td>
                                      <td className="py-3 px-2 text-slate-500">{m.assessment.date}</td>
                                      <td className="py-3 px-2 text-slate-900 font-mono">{m.score}/{m.assessment.maxMarks}</td>
                                      <td className="py-3 px-2 text-right">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-xs ${
                                          percentage >= 80 ? 'bg-emerald-100 text-emerald-700' : 
                                          percentage < 50 ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                          {grade}
                                        </span>
                                        <span className="ml-2 text-[10px] text-slate-400 font-medium">{percentage.toFixed(0)}%</span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card h-full flex flex-col items-center justify-center p-12 text-center text-slate-400">
                    <Users className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">Select a student to view detailed performance</p>
                    <p className="text-sm">You can search or filter students using the sidebar</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'assessments' && (
            <motion.div 
              key="assessments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">Assessments & Marks</h2>
                <button 
                  onClick={() => {
                    const defaultYear = (yearFilter !== 'all' && yearFilter !== 'IGCSE_ALL' && yearFilter !== 'IB_ALL') ? yearFilter : newAssessment.yearGroup;
                    setNewAssessment(prev => ({ 
                      ...prev, 
                      yearGroup: defaultYear,
                      subject: prev.yearGroup === defaultYear ? prev.subject : SUBJECTS_BY_YEAR[defaultYear][0]
                    }));
                    setShowAssessmentModal(true);
                  }}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Assessment
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pb-2">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'IGCSE_ALL', label: 'IGCSE' },
                    { id: 'IB_ALL', label: 'IB' },
                    { id: 7, label: 'Y7' },
                    { id: 8, label: 'Y8' },
                    { id: 9, label: 'Y9' },
                    { id: '10 IGCSE', label: 'Y10' },
                    { id: '11 IGCSE', label: 'Y11' },
                    { id: '12 IB', label: 'Y12' },
                    { id: '13 IB', label: 'Y13' },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => {
                        if (filter.id === 'all') setYearFilter('all');
                        else if (filter.id === 'IGCSE_ALL') setYearFilter('IGCSE_ALL');
                        else if (filter.id === 'IB_ALL') setYearFilter('IB_ALL');
                        else setYearFilter(filter.id as YearGroup);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        yearFilter === filter.id 
                          ? 'bg-white text-indigo-600 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assessments
                  .filter(a => matchesYearFilter(a.yearGroup, yearFilter))
                  .map(assessment => (
                  <div key={assessment.id} className="card p-6 hover:border-indigo-200 transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span 
                          className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2 inline-block"
                          style={{ 
                            backgroundColor: `${SUBJECT_COLORS[assessment.subject] || '#6366f1'}15`,
                            color: SUBJECT_COLORS[assessment.subject] || '#6366f1'
                          }}
                        >
                          {assessment.subject}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900">{assessment.name}</h3>
                        <p className="text-sm text-slate-500">
                          {formatYearGroup(assessment.yearGroup)} • {assessment.date}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            setEditingAssessmentId(assessment.id);
                            setNewAssessment({
                              name: assessment.name,
                              subject: assessment.subject,
                              maxMarks: assessment.maxMarks,
                              date: assessment.date,
                              yearGroup: assessment.yearGroup
                            });
                            setShowAssessmentModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Edit Assessment"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setAssessments(prev => prev.filter(a => a.id !== assessment.id));
                            setMarks(prev => prev.filter(m => m.assessmentId !== assessment.id));
                          }}
                          className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Delete Assessment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-50">
                      <div className="text-sm">
                        <span className="text-slate-500">Max Marks:</span>
                        <span className="ml-1 font-bold text-slate-900">{assessment.maxMarks}</span>
                      </div>
                      <button 
                        onClick={() => setShowMarksModal(assessment.id)}
                        className="text-indigo-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                      >
                        Manage Marks <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Grade Boundaries</h2>
                  <p className="text-slate-500">Define the minimum percentage required for each grade level.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      const newBoundaries = [...yearBoundaries[selectedYearForSettings]];
                      newBoundaries.push({ grade: 'New', minPercentage: 0 });
                      setYearBoundaries(prev => ({ ...prev, [selectedYearForSettings]: newBoundaries }));
                    }}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Grade
                  </button>
                  <select 
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={selectedYearForSettings}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!isNaN(parseInt(val)) && val.length === 1) setSelectedYearForSettings(parseInt(val) as YearGroup);
                      else setSelectedYearForSettings(val as YearGroup);
                    }}
                  >
                    {[7, 8, 9, '10 IGCSE', '11 IGCSE', '12 IB', '13 IB'].map(y => (
                      <option key={y} value={y}>{typeof y === 'number' ? `Year ${y}` : y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="card divide-y divide-slate-100">
                {yearBoundaries[selectedYearForSettings]
                  .sort((a, b) => b.minPercentage - a.minPercentage)
                  .map((boundary, idx) => {
                    const originalIdx = yearBoundaries[selectedYearForSettings].indexOf(boundary);
                    return (
                      <div key={idx} className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] text-slate-400 uppercase font-bold mb-1">Grade</span>
                            <input 
                              type="text"
                              className="w-14 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center font-bold text-indigo-600 text-center outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                              value={boundary.grade}
                              onChange={(e) => {
                                const newBoundaries = [...yearBoundaries[selectedYearForSettings]];
                                newBoundaries[originalIdx].grade = e.target.value;
                                setYearBoundaries(prev => ({ ...prev, [selectedYearForSettings]: newBoundaries }));
                              }}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-slate-500">Minimum Percentage</span>
                              <div className="flex items-center gap-1">
                                <input 
                                  type="number" min="0" max="100"
                                  value={boundary.minPercentage}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const newBoundaries = [...yearBoundaries[selectedYearForSettings]];
                                    newBoundaries[originalIdx].minPercentage = Math.min(100, Math.max(0, val));
                                    setYearBoundaries(prev => ({ ...prev, [selectedYearForSettings]: newBoundaries }));
                                  }}
                                  className="w-14 px-1.5 py-0.5 text-right font-bold text-slate-900 border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                                <span className="font-bold text-slate-900">%</span>
                              </div>
                            </div>
                            <input 
                              type="range" min="0" max="100" 
                              value={boundary.minPercentage}
                              onChange={(e) => {
                                const newBoundaries = [...yearBoundaries[selectedYearForSettings]];
                                newBoundaries[originalIdx].minPercentage = parseInt(e.target.value);
                                setYearBoundaries(prev => ({ ...prev, [selectedYearForSettings]: newBoundaries }));
                              }}
                              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                          </div>
                        </div>
                        <button 
                          onClick={() => setYearBoundaries(prev => ({
                            ...prev,
                            [selectedYearForSettings]: prev[selectedYearForSettings].filter((_, i) => i !== originalIdx)
                          }))}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                <button 
                  onClick={() => handleAddGrade(false)}
                  className="w-full p-4 text-indigo-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Grade Level
                </button>
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setYearBoundaries(prev => ({ ...prev, [selectedYearForSettings]: [...DEFAULT_BOUNDARIES] }))}
                  className="btn-secondary"
                >
                  Reset to Defaults
                </button>
              </div>

              <div className="pt-8 border-t border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Manage Groups</h2>
                    <p className="text-slate-500">View and organize classes. Groups are automatically created when you import marks.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {groups
                    .filter(g => g.yearGroup === selectedYearForSettings)
                    .map((group) => (
                      <div key={group.id} className="card p-4 flex items-center gap-3 group">
                        <input 
                          type="text"
                          className="flex-1 bg-slate-100 rounded-lg px-3 py-2 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                          value={group.name}
                          onChange={(e) => {
                            const newName = e.target.value;
                            setGroups(prev => prev.map(g => g.id === group.id ? { ...g, name: newName } : g));
                            setStudents(prev => prev.map(s => s.yearGroup === selectedYearForSettings && s.groupName === group.name ? { ...s, groupName: newName } : s));
                          }}
                        />
                        <button 
                          onClick={() => setGroups(prev => prev.filter(g => g.id !== group.id))}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Bulk Data Import</h2>
                  <p className="text-slate-500">Upload a CSV file to import students, classes, and marks in one go.</p>
                </div>

                <div className="card p-6 bg-indigo-50 border-indigo-100">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-4 flex-1">
                      {[
                        'Download the template to see the required format.',
                        'Fill in student names, year groups, class names, and marks.',
                        'Upload the completed CSV to automatically organize your data.'
                      ].map((step, i) => (
                        <div key={i} className="flex items-center gap-3 text-indigo-700">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold">{i + 1}</div>
                          <p className="font-medium">{step}</p>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex flex-col gap-3 w-full md:w-auto">
                      <button onClick={downloadTemplate} className="btn-primary flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" />
                        Download Template
                      </button>
                      <label className="btn-secondary flex items-center justify-center gap-2 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Upload Completed File
                        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                      </label>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-white rounded-xl border border-indigo-100">
                    <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2 text-center">Expected CSV Headers:</h4>
                    <div className="flex flex-wrap justify-center gap-2">
                      {['studentName', 'yearGroup', 'groupName', 'assessmentName', 'subject', 'score', 'maxMarks', 'date'].map(header => (
                        <span key={header} className="px-2 py-1 bg-slate-100 rounded text-[10px] font-mono text-slate-600 border border-slate-200">
                          {header}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showAssessmentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card w-full max-w-md p-6"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6">
                {editingAssessmentId ? 'Edit Assessment' : 'Add New Assessment'}
              </h3>
              <form onSubmit={handleAddAssessment} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Year Group</label>
                    <select 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newAssessment.yearGroup}
                      onChange={e => {
                        const val = e.target.value;
                        const year = (!isNaN(parseInt(val)) && val.length === 1) ? parseInt(val) as YearGroup : val as YearGroup;
                        setNewAssessment({ ...newAssessment, yearGroup: year, subject: SUBJECTS_BY_YEAR[year][0] });
                      }}
                    >
                      {[7, 8, 9, '10 IGCSE', '11 IGCSE', '12 IB', '13 IB'].map(y => (
                        <option key={y} value={y}>{typeof y === 'number' ? `Year ${y}` : y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                    <select 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newAssessment.subject}
                      onChange={e => setNewAssessment({...newAssessment, subject: e.target.value})}
                    >
                      {SUBJECTS_BY_YEAR[newAssessment.yearGroup].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assessment Name</label>
                  <input 
                    required type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newAssessment.name}
                    onChange={e => setNewAssessment({...newAssessment, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Marks</label>
                    <input 
                      required type="number" 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newAssessment.maxMarks}
                      onChange={e => setNewAssessment({...newAssessment, maxMarks: parseInt(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                    <input 
                      required type="date" 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newAssessment.date}
                      onChange={e => setNewAssessment({...newAssessment, date: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => { setShowAssessmentModal(false); setEditingAssessmentId(null); }} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">
                    {editingAssessmentId ? 'Update Assessment' : 'Add Assessment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showStudentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card w-full max-w-md p-6"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6">Add New Student</h3>
              <form onSubmit={handleAddStudent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Student Name</label>
                  <input 
                    required type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newStudent.name}
                    onChange={e => setNewStudent({...newStudent, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Year Group</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newStudent.yearGroup}
                    onChange={e => {
                      const val = e.target.value;
                      const year = (!isNaN(parseInt(val)) && val.length === 1) ? parseInt(val) as YearGroup : val as YearGroup;
                      const firstGroup = groups.find(g => g.yearGroup === year)?.name || '';
                      setNewStudent({...newStudent, yearGroup: year, groupName: firstGroup});
                    }}
                  >
                    {[7, 8, 9, '10 IGCSE', '11 IGCSE', '12 IB', '13 IB'].map(y => (
                      <option key={y} value={y}>{typeof y === 'number' ? `Year ${y}` : y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Group / Class</label>
                  <select 
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newStudent.groupName}
                    onChange={e => setNewStudent({...newStudent, groupName: e.target.value})}
                  >
                    <option value="" disabled>Select Group</option>
                    {groups.filter(g => g.yearGroup === newStudent.yearGroup).map(g => (
                      <option key={g.id} value={g.name}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowStudentModal(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">Add Student</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showMarksModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="card w-full h-full md:h-[95vh] md:max-w-[95vw] p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Manage Assessment</h3>
                  <p className="text-sm text-slate-500">
                    {assessments.find(a => a.id === showMarksModal)?.name} • Max Marks: {assessments.find(a => a.id === showMarksModal)?.maxMarks}
                  </p>
                </div>
                <button onClick={() => setShowMarksModal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <Plus className="w-5 h-5 rotate-45 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
                <div className="lg:col-span-2 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Student Marks
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Filter Group:</span>
                      <select 
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        value={marksGroupFilter}
                        onChange={(e) => setMarksGroupFilter(e.target.value)}
                      >
                        <option value="all">All Groups</option>
                        {groups
                          .filter(g => {
                            const assessment = assessments.find(a => a.id === showMarksModal);
                            return assessment ? g.yearGroup === assessment.yearGroup : true;
                          })
                          .map(g => (
                            <option key={g.id} value={g.name}>{g.name}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {students
                        .filter(s => {
                          const assessment = assessments.find(a => a.id === showMarksModal);
                          const matchesYear = assessment ? s.yearGroup === assessment.yearGroup : true;
                          const matchesGroup = marksGroupFilter === 'all' || s.groupName === marksGroupFilter;
                          return matchesYear && matchesGroup;
                        })
                        .map(student => {
                          const mark = marks.find(m => m.studentId === student.id && m.assessmentId === showMarksModal);
                          return (
                            <div key={student.id} className="flex items-center justify-between p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                              <div className="min-w-0 flex-1 mr-2">
                                <p className="font-bold text-slate-900 text-[11px] truncate">{student.name}</p>
                                <p className="text-[9px] text-slate-500 truncate">{student.groupName}</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <input 
                                  type="number" 
                                  placeholder="Score"
                                  className="w-14 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[11px] outline-none focus:ring-2 focus:ring-indigo-500"
                                  value={mark?.score ?? ''}
                                  min="0"
                                  max={assessments.find(a => a.id === showMarksModal)?.maxMarks || 100}
                                  onChange={e => handleUpdateMark(student.id, showMarksModal, parseFloat(e.target.value) || 0)}
                                />
                                <span className="text-[9px] font-bold text-slate-400 w-7 text-right">
                                  {mark ? `${((mark.score / (assessments.find(a => a.id === showMarksModal)?.maxMarks || 1)) * 100).toFixed(0)}%` : '-%'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col overflow-hidden">
                  <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Assessment Boundaries
                  </h4>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                    <p className="text-xs text-slate-500 italic">
                      Custom boundaries for this assessment. If not set, class defaults will be used.
                    </p>
                    <div className="space-y-3">
                      {(assessments.find(a => a.id === showMarksModal)?.boundaries || yearBoundaries[students.find(s => marks.find(m => m.assessmentId === showMarksModal)?.studentId === s.id)?.yearGroup || 7])
                        .sort((a, b) => b.minPercentage - a.minPercentage)
                        .map((boundary, idx) => {
                          const assessment = assessments.find(a => a.id === showMarksModal)!;
                          const sourceBoundaries = assessment.boundaries || yearBoundaries[students.find(s => marks.find(m => m.assessmentId === showMarksModal)?.studentId === s.id)?.yearGroup || 7];
                          const originalIdx = sourceBoundaries.indexOf(boundary);

                          return (
                            <div key={idx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <div className="flex flex-col items-center">
                                <span className="text-[7px] text-slate-400 uppercase font-bold mb-0.5">Grade</span>
                                <input 
                                  type="text"
                                  className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center font-bold text-indigo-600 text-center text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                  value={boundary.grade}
                                  onChange={(e) => {
                                    const currentBoundaries = [...sourceBoundaries];
                                    currentBoundaries[originalIdx].grade = e.target.value;
                                    setAssessments(prev => prev.map(a => a.id === showMarksModal ? { ...a, boundaries: currentBoundaries } : a));
                                  }}
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between text-[10px] mb-1">
                                  <span className="text-slate-500">Min %</span>
                                  <div className="flex items-center gap-1">
                                    <input 
                                      type="number" min="0" max="100"
                                      value={boundary.minPercentage}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0;
                                        const currentBoundaries = [...sourceBoundaries];
                                        currentBoundaries[originalIdx].minPercentage = Math.min(100, Math.max(0, val));
                                        setAssessments(prev => prev.map(a => a.id === showMarksModal ? { ...a, boundaries: currentBoundaries } : a));
                                      }}
                                      className="w-12 px-1 py-0.5 text-right font-bold text-slate-900 border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 text-[10px]"
                                    />
                                    <span className="font-bold text-slate-900 text-[10px]">%</span>
                                  </div>
                                </div>
                                <input 
                                  type="range" min="0" max="100" 
                                  value={boundary.minPercentage}
                                  onChange={(e) => {
                                    const currentBoundaries = [...sourceBoundaries];
                                    currentBoundaries[originalIdx].minPercentage = parseInt(e.target.value);
                                    setAssessments(prev => prev.map(a => a.id === showMarksModal ? { ...a, boundaries: currentBoundaries } : a));
                                  }}
                                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                              </div>
                              <button 
                                onClick={() => {
                                  const currentBoundaries = sourceBoundaries.filter((_, i) => i !== originalIdx);
                                  setAssessments(prev => prev.map(a => a.id === showMarksModal ? { ...a, boundaries: currentBoundaries } : a));
                                }}
                                className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      <button 
                        onClick={() => handleAddGrade(true, showMarksModal)}
                        className="w-full py-2 border border-dashed border-slate-300 rounded-xl text-indigo-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add Grade Level
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 mt-4">
                <button onClick={() => setShowMarksModal(null)} className="btn-primary w-full">Save and Close</button>
              </div>
            </motion.div>
          </div>
        )}

        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card w-full max-w-md p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Confirm Import</h3>
                  <p className="text-sm text-slate-500">File: {pendingImport?.fileName}.csv</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Year Group</label>
                    <select 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                      value={importConfig.yearGroup}
                      onChange={e => {
                        const val = e.target.value;
                        const year = (!isNaN(parseInt(val)) && val.length === 1) ? parseInt(val) as YearGroup : val as YearGroup;
                        setImportConfig({ ...importConfig, yearGroup: year, subject: SUBJECTS_BY_YEAR[year][0] });
                      }}
                    >
                      {[7, 8, 9, '10 IGCSE', '11 IGCSE', '12 IB', '13 IB'].map(y => (
                        <option key={y} value={y}>{typeof y === 'number' ? `Year ${y}` : y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Class Name</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                      value={importConfig.groupName}
                      onChange={e => setImportConfig({ ...importConfig, groupName: e.target.value })}
                      placeholder="e.g. 10A"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Assessment Name</label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                    value={importConfig.assessmentName}
                    onChange={e => setImportConfig({ ...importConfig, assessmentName: e.target.value })}
                    placeholder="e.g. End of Term Test"
                    disabled={importConfig.assessmentName.includes('Multiple')}
                  />
                  {importConfig.assessmentName.includes('Multiple') && (
                    <p className="text-[10px] text-indigo-600 mt-1 font-medium">
                      ✨ Multi-assessment detected! The system will use names from your CSV.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Subject</label>
                    <select 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                      value={importConfig.subject}
                      onChange={e => setImportConfig({ ...importConfig, subject: e.target.value })}
                    >
                      {SUBJECTS_BY_YEAR[importConfig.yearGroup].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Max Marks</label>
                    <input 
                      type="number"
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                      value={importConfig.maxMarks}
                      onChange={e => setImportConfig({ ...importConfig, maxMarks: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                    value={importConfig.date}
                    onChange={e => setImportConfig({ ...importConfig, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => { setShowImportModal(false); setPendingImport(null); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button onClick={confirmImport} className="btn-primary flex-1">
                  Import {pendingImport?.data.length} Rows
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="bg-white border-t border-slate-200 py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">© 2024 EduTracker Pro. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Documentation</a>
            <a href="#" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Support</a>
            <a href="#" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
