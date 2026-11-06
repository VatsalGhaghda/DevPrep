import { LayoutDashboard, User, Brain, PlayCircle, FileText, Code2, BarChart3 } from 'lucide-react';

// Shared navigation for every signed-in page. Add new pages here once.
export const SIDEBAR_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard },
  { label: 'Profile', path: '/profile', Icon: User },
  { label: 'Question Generator', path: '/questions/generate', Icon: Brain },
  { label: 'Mock Interview', path: '/interview/mock', Icon: PlayCircle },
  { label: 'Resume Interview', path: '/interview/resume', Icon: FileText },
  { label: 'Coding Practice', path: '/coding/practice', Icon: Code2 },
  { label: 'Dev Analytics', path: '/analytics', Icon: BarChart3 }
];

export const NAVBAR_LINKS = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Questions', path: '/questions/generate' },
  { label: 'Mock', path: '/interview/mock' },
  { label: 'Resume', path: '/interview/resume' },
  { label: 'Coding', path: '/coding/practice' },
  { label: 'Analytics', path: '/analytics' }
];
